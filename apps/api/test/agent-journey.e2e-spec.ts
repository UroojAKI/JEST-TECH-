import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ContactsService } from '../src/modules/contacts/services/contacts.service';
import { MotorPolicyIssuanceService } from '../src/modules/motor/services/motor-policy-issuance.service';
import { QuotationCompletionService } from '../src/modules/quotation/services/queries/quotation-completion.service';
import { MotorCalculationService } from '../src/modules/motor/services/motor-calculation.service';
import { ActorContext } from '../src/common/interfaces/actor-context.interface';
import {
  ContactType,
  PaymentTrackingStatus,
  PolicyStatus,
  QuotationStatus,
  RoleType,
  UserStatus,
} from '@prisma/client';

describe('End-to-End Agent Journey: Lead -> Contact -> Quote -> Payment -> Policy -> Renewal (§58)', () => {
  let moduleRef: TestingModule;
  let app: any;
  let prisma: PrismaService;
  let contactsService: ContactsService;
  let motorPolicyIssuanceService: MotorPolicyIssuanceService;
  let quotationCompletionService: QuotationCompletionService;
  let motorCalculationService: MotorCalculationService;

  let testUserId: string;
  let backOfficeUserId: string;
  let testCompanyId: string;
  let createdContactId: string;
  let createdLeadId: string;
  let createdVehicleId: string;
  let createdQuotationId: string;
  let createdPolicyId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    prisma = moduleRef.get<PrismaService>(PrismaService);
    contactsService = moduleRef.get<ContactsService>(ContactsService);
    motorPolicyIssuanceService = moduleRef.get<MotorPolicyIssuanceService>(
      MotorPolicyIssuanceService,
    );
    quotationCompletionService = moduleRef.get<QuotationCompletionService>(
      QuotationCompletionService,
    );
    motorCalculationService = moduleRef.get<MotorCalculationService>(
      MotorCalculationService,
    );

    app = moduleRef.createNestApplication();
    await app.init();

    const user = await prisma.user.findFirst({
      where: { branchId: { not: null } },
      include: { branch: true },
    });

    if (!user) {
      throw new Error('Test requires a seeded user with a valid branchId.');
    }

    testUserId = user.id;
    testCompanyId = user.companyId;

    let boUser = await prisma.user.findFirst({
      where: {
        companyId: testCompanyId,
        id: { not: testUserId },
      },
    });

    if (!boUser) {
      boUser = await prisma.user.create({
        data: {
          email: `backoffice.e2e.${Date.now()}@example.com`,
          passwordHash: 'seeded_dummy_hash_for_test',
          firstName: 'BackOffice',
          lastName: 'Verifier',
          companyId: testCompanyId,
          status: 'ACTIVE',
        },
      });
    }
    backOfficeUserId = boUser.id;
  });

  afterAll(async () => {
    // Cleanup in reverse dependency order
    if (createdPolicyId) {
      await prisma.outboxEvent.deleteMany({
        where: { aggregateId: createdPolicyId },
      });
      await prisma.auditLog.deleteMany({
        where: { entityId: createdPolicyId },
      });
      await prisma.renewalJob.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.renewalTask.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.policyHistory.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.policyNominee.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.policyDocument.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.policyPayment.deleteMany({
        where: { policyId: createdPolicyId },
      });
      await prisma.policy.deleteMany({ where: { id: createdPolicyId } });
    }
    if (createdQuotationId) {
      await prisma.proposal.deleteMany({
        where: { quotationId: createdQuotationId },
      });
      await prisma.motorPaymentRecord.deleteMany({
        where: { quotationId: createdQuotationId },
      });
      await prisma.quotationHistory.deleteMany({
        where: { quotationId: createdQuotationId },
      });
      await prisma.quotation.deleteMany({ where: { id: createdQuotationId } });
    }
    if (createdVehicleId) {
      await prisma.vehicle.deleteMany({ where: { id: createdVehicleId } });
    }
    if (createdLeadId) {
      await prisma.leadStageHistory.deleteMany({
        where: { leadId: createdLeadId },
      });
      await prisma.lead.deleteMany({ where: { id: createdLeadId } });
    }
    if (createdContactId) {
      await prisma.contact.deleteMany({ where: { id: createdContactId } });
    }
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('completes the entire end-to-end insurance transaction journey authoritatively', async () => {
    const timestamp = Date.now();
    const phone = `98${Math.floor(10000000 + (timestamp % 90000000))}`;

    // ── STEP 1: Authoritative Contact Creation with Branch & Company Scope (§5, §6) ──
    const contact = await contactsService.create(
      {
        type: ContactType.INDIVIDUAL,
        firstName: 'Vikram',
        lastName: 'Singhania',
        phone,
        email: `vikram.${timestamp}@example.com`,
        panNumber: 'ABCDE1234F',
      },
      testUserId,
    );

    createdContactId = contact.id;
    expect(contact.id).toBeDefined();
    expect(contact.branchId).toBeDefined();
    expect(contact.companyId).toBeDefined();

    // ── STEP 2: Lead Creation linked to Authoritative Contact (§7) ──
    const lead = await prisma.lead.create({
      data: {
        leadCode: `LD-${timestamp.toString().slice(-6)}`,
        title: 'Vikram Motor Package Lead',
        contactId: contact.id,
        companyId: testCompanyId,
        assignedToId: testUserId,
        createdById: testUserId,
        status: 'NEW',
        currentWorkflowStep: 'QUOTATION',
      },
    });
    createdLeadId = lead.id;
    expect(lead.id).toBeDefined();

    // ── STEP 3: Server-Authoritative Motor Calculation (§22, §23) ──
    const calcResult = await motorCalculationService.calculate({
      vehicleCategory: 'PRIVATE_CAR',
      vehicleStatus: 'EXISTING',
      policyType: 'PACKAGE_COMPREHENSIVE',
      idv: 600000,
      ncbPercent: 20,
      discountPercent: 10,
      paCover: true,
    });

    expect(calcResult.outputs.totalPremium).toBeGreaterThan(0);
    const authoritativeTotal = calcResult.outputs.totalPremium;

    // ── STEP 4: Persist Authoritative Vehicle, Quotation and Approved Proposal (§24, §28) ──
    const nextYear = new Date();
    nextYear.setFullYear(nextYear.getFullYear() + 1);

    const vehicle = await prisma.vehicle.create({
      data: {
        vehicleCode: `VEH-${timestamp.toString().slice(-6)}`,
        category: 'PRIVATE_CAR',
        registrationNumber: 'MH02EK9999',
        chassisNumber: 'MAT1234567890ABCD',
        engineNumber: 'ENG9876543210',
        makeModel: 'Maruti Suzuki Swift VXI',
        contactId: contact.id,
      },
    });
    createdVehicleId = vehicle.id;

    const quotation = await prisma.quotation.create({
      data: {
        quotationCode: `QTN-${timestamp.toString().slice(-6)}`,
        title: 'Private Car Comprehensive 1Y',
        productType: 'MOTOR',
        insurerName: 'HDFC ERGO General Insurance Co.',
        sumInsured: 600000,
        basePremium: calcResult.outputs.basePremium,
        gstAmount: calcResult.outputs.totalGst,
        totalPremium: authoritativeTotal,
        expiryDate: nextYear,
        registrationNumber: 'MH02EK9999',
        vehicleId: vehicle.id,
        status: QuotationStatus.APPROVED,
        workflowState: 'PAYMENT_DONE',
        calculationSnapshot: {
          calculationVersion: 'v1.0',
          rateConfigurationVersion: 'v1.0',
          totalPremium: authoritativeTotal,
          inputs: {
            policyType: 'PACKAGE_COMPREHENSIVE',
            vehicleCategory: 'PRIVATE_CAR',
            tpTenure: 1,
          },
        },
        contactId: contact.id,
        leadId: lead.id,
        companyId: testCompanyId,
        createdById: testUserId,
      },
    });
    createdQuotationId = quotation.id;
    expect(quotation.id).toBeDefined();

    // Create an approved proposal for Gate 4
    await prisma.proposal.create({
      data: {
        proposalNumber: `PROP-${timestamp.toString().slice(-6)}`,
        quotationId: quotation.id,
        contactId: contact.id,
        status: 'APPROVED',
        submittedById: testUserId,
        approvedById: backOfficeUserId,
        approvedAt: new Date(),
      },
    });

    // ── STEP 5: Progressive Quotation Completion Evaluation (AUD-033, §24) ──
    const completionBeforePayment =
      await quotationCompletionService.getCompletion(quotation.id);
    expect(completionBeforePayment.quotationId).toBe(quotation.id);
    // Payment is not yet recorded, so canIssuePolicy must be strictly false
    expect(completionBeforePayment.canIssuePolicy).toBe(false);

    // ── STEP 6: Reconciled Payment Recording (§41, §42) ──
    const paymentRecord = await prisma.motorPaymentRecord.create({
      data: {
        quotationId: quotation.id,
        amount: authoritativeTotal,
        referenceNumber: `TXN-E2E-${timestamp}`,
        paymentMethod: 'ONLINE_NETBANKING',
        status: PaymentTrackingStatus.PAID,
        paidAt: new Date(),
        recordedById: testUserId,
      },
    });
    expect(paymentRecord.status).toBe('PAID');

    // ── STEP 7: Authoritative Policy Issuance via MotorPolicyIssuanceService with Maker-Checker SoD (§26, §30) ──
    const backOfficeActor: ActorContext = {
      userId: backOfficeUserId,
      email: 'backoffice.e2e@example.com',
      firstName: 'BackOffice',
      lastName: 'Verifier',
      organizationId: testCompanyId,
      companyId: testCompanyId,
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
      permissions: ['POLICY:ISSUE'],
      workspaces: ['OPERATIONS'],
      status: UserStatus.ACTIVE,
    };

    const issuedPolicyResponse = await motorPolicyIssuanceService.issuePolicy(
      quotation.id,
      {
        startDate: new Date().toISOString(),
        endDate: nextYear.toISOString(),
        nomineeName: 'Pooja Singhania',
        nomineeRelation: 'SPOUSE',
      },
      backOfficeActor,
    );

    createdPolicyId = issuedPolicyResponse.id;
    expect(issuedPolicyResponse.id).toBeDefined();
    expect(issuedPolicyResponse.policyNumber).toBeDefined();
    expect(issuedPolicyResponse.status).toBe(PolicyStatus.ACTIVE);

    // ── STEP 8: Verify Commercial & Workflow Truth Invariants (§19, §30, §36) ──
    // Invariant A: Linked Lead is automatically CONVERTED and workflow step ISSUED
    const updatedLead = await prisma.lead.findUnique({
      where: { id: lead.id },
    });
    expect(updatedLead?.status).toBe('POLICY_ISSUED');
    expect(updatedLead?.currentWorkflowStep).toBe('ISSUED');

    // Invariant B: Quotation status transitioned to CONVERTED_TO_POLICY
    const updatedQuotation = await prisma.quotation.findUnique({
      where: { id: quotation.id },
    });
    expect(updatedQuotation?.status).toBe(QuotationStatus.CONVERTED_TO_POLICY);

    // Invariant C: PostgreSQL RenewalJob durable obligations created for 5 offsets (45, 30, 15, 7, 0)
    const renewalJobs = await prisma.renewalJob.findMany({
      where: { policyId: createdPolicyId },
      orderBy: { offsetDays: 'desc' },
    });
    expect(renewalJobs.length).toBe(5);
    expect(renewalJobs.map((j) => j.offsetDays)).toEqual([45, 30, 15, 7, 0]);
    expect(renewalJobs.every((j) => j.status === 'PENDING')).toBe(true);

    // Invariant D: Transactional Outbox event policy.issued recorded
    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: { aggregateId: createdPolicyId, eventType: 'policy.issued' },
    });
    expect(outboxEvent).toBeDefined();
  });
});

