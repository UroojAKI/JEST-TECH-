import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { ProposalService } from '../src/modules/proposal/services/proposal.service';
import { PrismaService } from '../src/database/prisma.service';
import {
  ProposalStatus,
  PolicyStatus,
  ContactType,
  RoleType,
  Prisma,
} from '@prisma/client';

describe('Workflow & Proposal Integration', () => {
  let moduleRef: TestingModule;
  let proposalService: ProposalService;
  let prisma: PrismaService;
  let testProposalId: string;
  let testQuotationId: string;
  let testContactId: string;
  let testUserId: string;
  let testCompanyId: string;
  let testWorkflowId: string | undefined;
  let shouldDeleteTestWorkflow = false;
  let app: any;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    proposalService = moduleRef.get<ProposalService>(ProposalService);
    prisma = moduleRef.get<PrismaService>(PrismaService);

    app = moduleRef.createNestApplication();
    await app.init();

    // Ensure all custom sequences exist in database
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS policy_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS claim_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS contact_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS account_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS endorsement_number_seq START 1 INCREMENT 1;`,
      ),
    );
    await prisma.$executeRaw(
      Prisma.raw(
        `CREATE SEQUENCE IF NOT EXISTS proposal_number_seq START 1 INCREMENT 1;`,
      ),
    );

    // Fetch a Back Office / Admin reviewer user from the seeded database or auto-provision
    let user = await prisma.user.findFirst({
      where: {
        role: {
          type: { in: [RoleType.ADMIN, RoleType.BACK_OFFICE] },
        },
      },
    });
    if (!user) {
      const company = await prisma.company.create({
        data: {
          name: 'E2E Proposal Company',
          code: `PROPCO_${Date.now()}`,
          isActive: true,
        },
      });
      const boRole = await prisma.role.findFirst({
        where: { type: RoleType.BACK_OFFICE },
      });
      user = await prisma.user.create({
        data: {
          email: `proposal.e2e.${Date.now()}@example.com`,
          passwordHash: 'seeded_dummy_hash_for_test',
          firstName: 'Workflow',
          lastName: 'Tester',
          companyId: company.id,
          roleId: boRole?.id,
          status: 'ACTIVE',
        },
      });
    }
    testUserId = user.id;
    testCompanyId = user.companyId;

    // This E2E suite runs after migrations, not after the full demo seed.
    // Create the required system workflow fixture when it is absent so the test
    // remains repeatable against a fresh CI database.
    let proposalWorkflow = await prisma.workflow.findUnique({
      where: { code: 'PROPOSAL_WORKFLOW' },
      include: {
        states: true,
        transitions: { include: { fromState: true, toState: true } },
      },
    });

    if (!proposalWorkflow) {
      proposalWorkflow = await prisma.workflow.create({
        data: {
          name: 'Standard Proposal Workflow',
          code: 'PROPOSAL_WORKFLOW',
          module: 'PROPOSALS',
          isSystem: true,
        },
        include: {
          states: true,
          transitions: { include: { fromState: true, toState: true } },
        },
      });
      testWorkflowId = proposalWorkflow.id;
      shouldDeleteTestWorkflow = true;
    } else {
      testWorkflowId = proposalWorkflow.id;
    }

    const stateDefinitions = [
      { code: 'DRAFT', name: 'Draft', isInitial: true, isTerminal: false },
      { code: 'SUBMITTED', name: 'Submitted', isInitial: false, isTerminal: false, slaMinutes: 1440 },
      { code: 'UNDER_REVIEW', name: 'Under Review', isInitial: false, isTerminal: false, slaMinutes: 2880 },
      { code: 'APPROVED', name: 'Approved', isInitial: false, isTerminal: true },
      { code: 'REJECTED', name: 'Rejected', isInitial: false, isTerminal: true },
    ];

    const stateIds: Record<string, string> = {};
    for (const state of stateDefinitions) {
      let stateRecord = proposalWorkflow.states.find(
        (candidate) => candidate.code === state.code,
      );
      if (!stateRecord) {
        stateRecord = await prisma.workflowState.create({
          data: { workflowId: proposalWorkflow.id, ...state },
        });
      }
      stateIds[state.code] = stateRecord.id;
    }

    const transitionDefinitions: Array<{
      name: string;
      fromCode: string;
      toCode: string;
      conditions?: Prisma.InputJsonValue;
    }> = [
      { name: 'Submit Proposal', fromCode: 'DRAFT', toCode: 'SUBMITTED' },
      { name: 'Start Review', fromCode: 'SUBMITTED', toCode: 'UNDER_REVIEW' },
      {
        name: 'Approve Proposal',
        fromCode: 'UNDER_REVIEW',
        toCode: 'APPROVED',
        conditions: {
          logic: 'AND',
          rules: [{ field: 'premiumAmount', operator: 'lte', value: 50000 }],
        },
      },
      {
        name: 'Approve High Premium',
        fromCode: 'UNDER_REVIEW',
        toCode: 'APPROVED',
        conditions: {
          logic: 'AND',
          rules: [{ field: 'premiumAmount', operator: 'gt', value: 50000 }],
        },
      },
      { name: 'Reject Proposal', fromCode: 'UNDER_REVIEW', toCode: 'REJECTED' },
    ];

    for (const transition of transitionDefinitions) {
      const existingTransition = await prisma.workflowTransition.findFirst({
        where: {
          workflowId: proposalWorkflow.id,
          name: transition.name,
        },
      });
      if (!existingTransition) {
        await prisma.workflowTransition.create({
          data: {
            workflowId: proposalWorkflow.id,
            name: transition.name,
            triggerType: 'MANUAL',
            fromStateId: stateIds[transition.fromCode],
            toStateId: stateIds[transition.toCode],
            ...(transition.conditions
              ? { conditions: transition.conditions }
              : {}),
          },
        });
      }
    }
  });

  afterAll(async () => {
    // Cleanup created test proposal and related records
    if (testProposalId) {
      await prisma.policy.deleteMany({ where: { proposalId: testProposalId } });
      await prisma.proposalDocument.deleteMany({
        where: { proposalId: testProposalId },
      });
      await prisma.proposalHistory.deleteMany({
        where: { proposalId: testProposalId },
      });
      await prisma.workflowHistory.deleteMany({
        where: { entityId: testProposalId },
      });
      await prisma.proposal.delete({ where: { id: testProposalId } });
    }
    if (testQuotationId) {
      await prisma.quotation.delete({ where: { id: testQuotationId } });
    }
    if (testContactId) {
      await prisma.contact.delete({ where: { id: testContactId } });
    }
    if (shouldDeleteTestWorkflow && testWorkflowId) {
      await prisma.workflow.delete({ where: { id: testWorkflowId } });
    }
    if (app) {
      await app.close();
    }
  });

  it('should initialize, submit, and approve proposal via Workflow Engine, issuing policy', async () => {
    // 1. Create a dummy contact
    const contact = await prisma.contact.create({
      data: {
        contactCode: `CON-TEST-${Date.now()}`,
        type: ContactType.INDIVIDUAL,
        firstName: 'Integration',
        lastName: 'Test',
        email: `test-${Date.now()}@example.com`,
        phone: '1234567890',
        companyId: testCompanyId,
        createdById: testUserId,
      },
    });
    testContactId = contact.id;

    // 2. Create a dummy quotation under 50k premium
    const quotation = await prisma.quotation.create({
      data: {
        quotationCode: `QTN-TEST-${Date.now()}`,
        title: 'Integration Test Health Quote',
        insurerName: 'Test Insurer',
        productType: 'HEALTH',
        sumInsured: 500000,
        gstAmount: 1800,
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        contactId: contact.id,
        basePremium: 10000,
        totalPremium: 11800,
        companyId: testCompanyId,
        createdById: testUserId,
      },
    });
    testQuotationId = quotation.id;

    // 3. Create a proposal in DRAFT state
    const proposal = await proposalService.createProposal(
      quotation.id,
      testUserId,
    );
    testProposalId = proposal.id;
    expect(proposal.status).toBe(ProposalStatus.DRAFT);

    // Fill all mandatory documents to bypass submission checks
    const documents = await prisma.proposalDocument.findMany({
      where: { proposalId: proposal.id },
    });

    // Create a dummy document record in DB
    const dummyDoc = await prisma.document.create({
      data: {
        documentNumber: `DOC-TEST-${Date.now()}`,
        name: 'Dummy Integration Test Document',
        originalFileName: 'test.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        storageKey: 'documents/test.pdf',
        storageProvider: 'LOCAL',
        hash: 'dummy-hash',
        entityType: 'PROPOSAL',
        entityId: 'dummy-id',
        uploadedById: testUserId,
      },
    });

    for (const doc of documents) {
      await proposalService.attachDocument(
        proposal.id,
        doc.id,
        dummyDoc.id,
        testUserId,
      );
    }

    // 4. Submit proposal
    const submitted = await proposalService.submitProposal(
      proposal.id,
      testUserId,
    );
    expect(submitted!.status).toBe(ProposalStatus.SUBMITTED);

    // 5. Start review (transitions SUBMITTED -> UNDER_REVIEW)
    const reviewStartResult = await proposalService.reviewProposal(
      proposal.id,
      true,
      'Starting review',
      testUserId,
    );
    expect(reviewStartResult.proposal!.status).toBe(
      ProposalStatus.UNDER_REVIEW,
    );

    // 6. Review and Approve proposal (transitions UNDER_REVIEW -> APPROVED -> POLICY_ISSUED)
    const reviewResult = await proposalService.reviewProposal(
      proposal.id,
      true,
      'Looks good',
      testUserId,
    );

    expect(reviewResult.proposal!.status).toBe(ProposalStatus.POLICY_ISSUED);
    expect(reviewResult.policy).toBeDefined();
    expect(reviewResult.policy!.status).toBe(PolicyStatus.ACTIVE);
    expect(Number(reviewResult.policy!.premiumAmount)).toBe(11800);

    // Cleanup the dummy doc
    await prisma.document.delete({ where: { id: dummyDoc.id } });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });
});
