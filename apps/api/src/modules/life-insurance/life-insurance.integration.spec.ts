import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  Gender,
  LifeCaseStatus,
  LifePlanCategory,
  LifePolicyType,
  LifeRiderType,
  PaymentTrackingStatus,
  PremiumPaymentFrequency,
  PremiumPaymentType,
  QuotationStatus,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { LifeQuotationCaseService } from './services/life-quotation-case.service';
import { LifeQuotationCalculationService } from './services/life-quotation-calculation.service';
import { LifeQuotationDocumentService } from './services/life-quotation-document.service';
import { NumberingEngineService } from '../administration/services/numbering-engine/numbering-engine.service';
import { TenantResourceAuthorizationService } from '../auth/services/tenant-resource-authorization.service';
import { AgentIdentityResolverService } from '../agents/agent-identity-resolver.service';
import { BackOfficeQueueService } from '../policies/services/queries/back-office-queue.service';

describe('Life Insurance CRM Integration (PostgreSQL)', () => {
  let prisma: PrismaService;
  let caseService: LifeQuotationCaseService;
  let documentService: LifeQuotationDocumentService;
  let calculationService: LifeQuotationCalculationService;
  let backOfficeQueueService: BackOfficeQueueService;

  let testCompanyId: string;
  let testContactId: string;
  let testUserId: string;
  let testDocId: string;

  const mockActor = (role = RoleType.BACK_OFFICE): any => ({
    id: testUserId,
    userId: testUserId,
    companyId: testCompanyId,
    email: 'tester@example.com',
    firstName: 'Life',
    lastName: 'Tester',
    organizationId: testCompanyId,
    role,
  });

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaService,
        LifeQuotationCaseService,
        LifeQuotationCalculationService,
        LifeQuotationDocumentService,
        NumberingEngineService,
        TenantResourceAuthorizationService,
        AgentIdentityResolverService,
        BackOfficeQueueService,
      ],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    caseService = module.get<LifeQuotationCaseService>(LifeQuotationCaseService);
    documentService = module.get<LifeQuotationDocumentService>(LifeQuotationDocumentService);
    calculationService = module.get<LifeQuotationCalculationService>(LifeQuotationCalculationService);
    backOfficeQueueService = module.get<BackOfficeQueueService>(BackOfficeQueueService);

    // Reuse existing company or create test tenant
    let company = await prisma.company.findFirst();
    if (!company) {
      company = await prisma.company.create({
        data: {
          name: `Life Test Tenant ${Date.now()}`,
          code: `LTT-${Date.now()}`,
        },
      });
    }
    testCompanyId = company.id;

    // Reuse existing user or fetch one from company
    let user = await prisma.user.findFirst({ where: { companyId: testCompanyId } });
    if (!user) {
      user = await prisma.user.findFirst();
    }
    testUserId = user ? user.id : '00000000-0000-0000-0000-000000000001';

    const contact = await prisma.contact.create({
      data: {
        contactCode: `CONT-TEST-${Date.now().toString().slice(-6)}`,
        companyId: testCompanyId,
        firstName: 'Suresh',
        lastName: 'Raina',
        phone: `919${Date.now().toString().slice(-7)}`,
        email: `suresh.raina.${Date.now()}@example.com`,
        panNumber: 'ABCDE9876F',
        aadhaarNumber: '987654321098',
        dateOfBirth: new Date('1986-11-27'),
        gender: Gender.MALE,
        type: 'INDIVIDUAL',
        status: 'ACTIVE',
        createdById: testUserId,
      },
    });
    testContactId = contact.id;

    const doc = await prisma.document.create({
      data: {
        documentNumber: `DOC-L-${Date.now().toString().slice(-6)}`,
        name: 'PAN_Card.pdf',
        originalFileName: 'PAN_Card.pdf',
        mimeType: 'application/pdf',
        size: 102400,
        storageKey: `test/pan-${Date.now()}.pdf`,
        storageProvider: 'LOCAL',
        hash: 'test-hash',
        entityType: 'CONTACT',
        entityId: testContactId,
        uploadedById: testUserId,
      },
    });
    testDocId = doc.id;
  });

  afterAll(async () => {
    // Clean up created test data
    try {
      await prisma.lifeQuotationDocument.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.lifeQuotationRider.deleteMany({
        where: { quotation: { companyId: testCompanyId } },
      });
      await prisma.motorPaymentRecord.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.quotation.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.lifeQuotationCase.deleteMany({ where: { companyId: testCompanyId } });
      await prisma.document.deleteMany({ where: { id: testDocId } });
      await prisma.contact.deleteMany({ where: { id: testContactId } });
      await prisma.$disconnect();
    } catch {
      // Ignored during cleanup
    }
  });

  it('1. Creates a Life proposal case with LQC numbering sequence', async () => {
    const lifeCase = await caseService.createCase(
      {
        contactId: testContactId,
        planCategory: LifePlanCategory.TERM_INSURANCE,
        annualIncome: 1800000,
        smokerStatus: 'NON_SMOKER' as any,
        heightCm: 178,
        weightKg: 75,
        nomineeName: 'Priyanka Raina',
        nomineeDob: '1990-03-12',
        nomineeRelation: 'SPOUSE' as any,
      },
      mockActor(),
    );

    expect(lifeCase.id).toBeDefined();
    expect(lifeCase.caseCode).toMatch(/^LQC-\d{4}-\d{5}$/);
    expect(lifeCase.status).toBe(LifeCaseStatus.DRAFT);
    expect(lifeCase.isNomineeMinor).toBe(false);
    expect(Number(lifeCase.bmi)).toBeCloseTo(23.7, 1);
  });

  it('2. Adds multiple insurer quotes with line-item riders and no double-counting', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
    });
    expect(lifeCase).toBeDefined();

    // Quote 1: HDFC Life
    const quote1Case = await caseService.addQuote(
      lifeCase!.id,
      {
        insurerName: 'HDFC Life Insurance Co.',
        productCode: 'CLICK2PROTECT_SUPER',
        sumInsured: 15000000,
        basePremium: 22000,
        discountAmount: 1000,
        policyTermYears: 40,
        premiumPayingTermYears: 10,
        lifePolicyType: LifePolicyType.INDIVIDUAL_PURE_RISK,
        premiumPaymentType: PremiumPaymentType.LIMITED_PAY,
        premiumFrequency: PremiumPaymentFrequency.ANNUAL,
        brokeragePercent: 20,
        riders: [
          {
            riderType: LifeRiderType.ACCIDENTAL_DEATH_BENEFIT,
            riderName: 'Accidental Death Rider',
            sumAssured: 5000000,
            basePremium: 3000,
            brokeragePercent: 15,
          },
        ],
      },
      mockActor(),
    );

    // Quote 2: ICICI Prudential Life
    const quote2Case = await caseService.addQuote(
      lifeCase!.id,
      {
        insurerName: 'ICICI Prudential Life',
        productCode: 'IPRU_IPROTECT_SMART',
        sumInsured: 15000000,
        basePremium: 21500,
        policyTermYears: 40,
        premiumPayingTermYears: 10,
        lifePolicyType: LifePolicyType.INDIVIDUAL_PURE_RISK,
        premiumPaymentType: PremiumPaymentType.LIMITED_PAY,
        premiumFrequency: PremiumPaymentFrequency.ANNUAL,
      },
      mockActor(),
    );

    expect(quote2Case.quotations.length).toBe(2);
    expect(quote2Case.status).toBe(LifeCaseStatus.QUOTED);

    const hdfcQuote = quote2Case.quotations.find((q: any) => q.insurerName.includes('HDFC'));
    expect(hdfcQuote).toBeDefined();
    expect(hdfcQuote!.lifeRiders.length).toBe(1);
    // Base 22,000 - Discount 1,000 + Rider 3,000 = 24,000 net base. Total 18% GST = 4,320. Total payable = 28,320
    expect(Number(hdfcQuote!.totalPremium)).toBe(28320);
  });

  it('3. Attaches document and evaluates dynamic checklist', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
    });

    const attachedDoc = await documentService.attachDocument(
      lifeCase!.id,
      {
        documentId: testDocId,
        documentType: 'PROPOSER_PAN' as any,
      },
      mockActor(),
    );

    expect(attachedDoc.id).toBeDefined();

    // Verify document by Back Office
    const verified = await documentService.verifyDocument(
      attachedDoc.id,
      { verificationStatus: 'VERIFIED' as any },
      mockActor(RoleType.BACK_OFFICE),
    );
    expect(verified.verificationStatus).toBe('VERIFIED');

    // Checklist evaluation
    const checklist = await documentService.evaluateChecklist(lifeCase!.id, mockActor());
    expect(checklist.requiredDocuments).toContain('PROPOSER_PAN');
    expect(checklist.uploadedDocuments.length).toBe(1);
  });

  it('4. Selects winning quotation and records reconciled payment', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
      include: { quotations: true },
    });

    const winningQuote = lifeCase!.quotations[0];
    const selected = await caseService.selectQuote(lifeCase!.id, winningQuote.id, mockActor());

    expect(selected.selectedQuoteId).toBe(winningQuote.id);
    expect(selected.status).toBe(LifeCaseStatus.APPROVED);

    // Record verified payment
    const withPayment = await caseService.recordPayment(
      lifeCase!.id,
      {
        referenceNumber: 'HDFC_UTR_998877',
        paymentMethod: 'NET_BANKING',
        status: PaymentTrackingStatus.PAID,
      },
      mockActor(RoleType.BACK_OFFICE),
    );

    expect(withPayment.selectedQuote?.motorPaymentRecord?.status).toBe(PaymentTrackingStatus.PAID);
  });

  it('5. Validates Back-Office Queue multi-gate compliance for Life quotation', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
    });

    const queue = await backOfficeQueueService.getBackOfficeQueue(mockActor(), {
      quotationId: lifeCase!.selectedQuoteId!,
    });

    expect(queue.data.length).toBe(1);
    const item = queue.data[0];
    expect(item.productType).toBe('LIFE');
    expect(item.gates.customer.passed).toBe(true);
    expect(item.gates.vehicle.passed).toBe(true); // Bypassed for LIFE
    expect(item.gates.inspection.passed).toBe(true); // Bypassed for LIFE
    expect(item.gates.payment.passed).toBe(true);
  });

  it('6. Cross-tenant security: Company B cannot retrieve Company A Life proposal', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
    });
    expect(lifeCase).toBeDefined();

    // Actor belonging to another company
    const foreignActor: any = {
      id: '00000000-0000-0000-0000-000000000999',
      userId: '00000000-0000-0000-0000-000000000999',
      companyId: '00000000-0000-0000-0000-000000000888',
      role: RoleType.BACK_OFFICE,
    };

    await expect(
      caseService.getCase(lifeCase!.id, foreignActor),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('7. Quote reselection: Switching selection reverts previous quote and marks new quote ACCEPTED', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
      include: { quotations: { orderBy: { createdAt: 'asc' } } },
    });
    expect(lifeCase!.quotations.length).toBeGreaterThanOrEqual(2);

    const quoteA = lifeCase!.quotations[0];
    const quoteB = lifeCase!.quotations[1];

    // Select Quote A
    const afterSelectA = await caseService.selectQuote(lifeCase!.id, quoteA.id, mockActor());
    expect(afterSelectA.selectedQuoteId).toBe(quoteA.id);

    const quoteADb1 = await prisma.quotation.findUnique({ where: { id: quoteA.id } });
    expect(quoteADb1?.status).toBe(QuotationStatus.ACCEPTED);

    // Now reselect Quote B
    const afterSelectB = await caseService.selectQuote(lifeCase!.id, quoteB.id, mockActor());
    expect(afterSelectB.selectedQuoteId).toBe(quoteB.id);

    // Verify Quote B is ACCEPTED and Quote A is reverted to PENDING_APPROVAL
    const quoteBDb = await prisma.quotation.findUnique({ where: { id: quoteB.id } });
    const quoteADb2 = await prisma.quotation.findUnique({ where: { id: quoteA.id } });

    expect(quoteBDb?.status).toBe(QuotationStatus.ACCEPTED);
    expect(quoteADb2?.status).toBe(QuotationStatus.PENDING_APPROVAL);
  });

  it('8. Underwriter rejection: Rejecting a mandatory document blocks policy issuance gates', async () => {
    const lifeCase = await prisma.lifeQuotationCase.findFirst({
      where: { companyId: testCompanyId, contactId: testContactId },
      include: { documents: true },
    });
    expect(lifeCase).toBeDefined();

    const docRecord = lifeCase!.documents[0];
    expect(docRecord).toBeDefined();

    // Underwriter marks document as REJECTED with mandatory reason
    await documentService.verifyDocument(
      docRecord.id,
      {
        verificationStatus: 'REJECTED' as any,
        rejectionReason: 'Unclear / blurry PAN scan, upload fresh color copy',
      },
      mockActor(RoleType.BACK_OFFICE),
    );

    // Check checklist status
    const checklist = await documentService.evaluateChecklist(lifeCase!.id, mockActor());
    expect(checklist.complianceStatus).toBe('REJECTED');
    expect(checklist.allMandatoryVerified).toBe(false);

    // Back office queue documents gate must be BLOCKED
    const queue = await backOfficeQueueService.getBackOfficeQueue(mockActor(), {
      quotationId: lifeCase!.selectedQuoteId!,
    });
    expect(queue.data.length).toBe(1);
    const item = queue.data[0];
    expect(item.gates.documents.passed).toBe(false);
    expect(item.allGatesPassed).toBe(false);

    // validateIssuanceGates must throw BadRequestException blocking policy issuance
    await expect(
      backOfficeQueueService.validateIssuanceGates(lifeCase!.selectedQuoteId!, mockActor()),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
