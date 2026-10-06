import {
  BackOfficeTaskStatus,
  InspectionStatus,
  MotorCaseStatus,
  PrismaClient,
  QuotationStatus,
  RoleType,
  VehicleCategory,
} from '@prisma/client';
import { MotorInspectionService } from '../services/motor-inspection.service';
import { PrismaService } from '../../../database/prisma.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

const databaseUrl = process.env.E2E_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite('Motor inspection journey (dedicated PostgreSQL)', () => {
  const prisma = new PrismaClient({
    // Jest still evaluates the callback passed to describe.skip. Keep client
    // construction valid without allowing any skipped hook to connect.
    datasources: {
      db: { url: databaseUrl ?? 'postgresql://skip:skip@localhost:5432/skip' },
    },
  });
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const companyId = `insp-e2e-company-${suffix}`;
  const quotationId = `insp-e2e-quotation-${suffix}`;
  const caseId = `insp-e2e-case-${suffix}`;
  let agentId: string;
  let backOfficeId: string;
  let userIds: string[] = [];
  let contactId: string;
  let inspectionId: string;
  let taskId: string;
  let service: MotorInspectionService;

  const actor = (userId: string, role: RoleType): ActorContext => ({
    userId,
    email: `${userId}@example.test`,
    firstName: role === RoleType.AGENT ? 'Agent' : 'Back Office',
    lastName: 'E2E',
    organizationId: companyId,
    companyId,
    role,
    roles: [role],
    permissions: ['*'],
    workspaces: ['DEFAULT'],
    status: 'ACTIVE' as any,
  });

  beforeAll(async () => {
    const [{ database }] = await prisma.$queryRaw<Array<{ database: string }>>`
      SELECT current_database() AS database
    `;
    if (database !== 'jest_policy_crm_e2e') {
      throw new Error(
        `Refusing to run persisted journey against non-test database: ${database}`,
      );
    }
    await prisma.$connect();

    await prisma.company.create({
      data: {
        id: companyId,
        name: `Inspection E2E ${suffix}`,
        code: `INSP-E2E-${suffix}`,
      },
    });
    const agent = await prisma.user.create({
      data: {
        companyId,
        firstName: 'Assigned',
        lastName: 'Agent',
        email: `agent-${suffix}@example.test`,
        passwordHash: 'test-only-not-authenticatable',
        status: 'ACTIVE',
      },
    });
    agentId = agent.id;
    userIds.push(agent.id);
    const backOffice = await prisma.user.create({
      data: {
        companyId,
        firstName: 'Independent',
        lastName: 'Reviewer',
        email: `reviewer-${suffix}@example.test`,
        passwordHash: 'test-only-not-authenticatable',
        status: 'ACTIVE',
      },
    });
    backOfficeId = backOffice.id;
    userIds.push(backOffice.id);
    const contact = await prisma.contact.create({
      data: {
        companyId,
        contactCode: `CONTACT-${suffix}`,
        type: 'INDIVIDUAL',
        firstName: 'Journey',
        lastName: 'Customer',
        phone: `9${suffix.replace(/\D/g, '').slice(-9).padStart(9, '0')}`,
      },
    });
    contactId = contact.id;
    await prisma.motorQuotationCase.create({
      data: {
        id: caseId,
        companyId,
        caseCode: `CASE-${suffix}`,
        category: VehicleCategory.PRIVATE_CAR,
        contactId,
        status: MotorCaseStatus.QUOTE_GENERATED,
        customerSnapshot: { name: 'Journey Customer' },
        vehicleSnapshot: { registrationNumber: 'E2E-001' },
      },
    });
    await prisma.quotation.create({
      data: {
        id: quotationId,
        quotationCode: `QUOTE-${suffix}`,
        title: 'Inspection journey test',
        companyId,
        contactId,
        insurerName: 'E2E Insurer',
        productType: 'PRIVATE_CAR',
        sumInsured: 500000,
        basePremium: 10000,
        gstAmount: 1800,
        totalPremium: 11800,
        expiryDate: new Date('2027-01-01T00:00:00Z'),
        createdById: agentId,
        caseId,
        status: QuotationStatus.DRAFT,
        workflowState: 'INSPECTION_REQUIRED',
      },
    });

    service = new MotorInspectionService(
      prisma as unknown as PrismaService,
      {
        generateNext: async (kind: string) => `${kind}-${suffix}`,
      } as any,
    );
  });

  afterAll(async () => {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.backOfficeTask.deleteMany({
          where: { companyId, sourceEntityId: quotationId },
        });
        await tx.outboxEvent.deleteMany({
          where: { aggregateId: inspectionId || '' },
        });
        await tx.motorInspection.deleteMany({ where: { quotationId } });
        await tx.quotation.deleteMany({ where: { id: quotationId } });
        await tx.motorQuotationCase.deleteMany({ where: { id: caseId } });
        await tx.contact.deleteMany({ where: { id: contactId || '' } });
        await tx.user.deleteMany({ where: { id: { in: userIds } } });
        await tx.company.deleteMany({ where: { id: companyId } });
      });
    } finally {
      await prisma.$disconnect();
    }
  });

  it('persists case/task identity and the agent-to-reviewer inspection lifecycle', async () => {
    const requested = await service.createInspection(
      { quotationId },
      actor(agentId, RoleType.AGENT),
    );
    inspectionId = requested.id;

    const task = await prisma.backOfficeTask.findUniqueOrThrow({
      where: {
        companyId_idempotencyKey: {
          companyId,
          idempotencyKey: `INSPECTION:${quotationId}:ASSIGNMENT`,
        },
      },
    });
    taskId = task.id;

    expect(requested.caseId).toBe(caseId);
    expect(task.caseId).toBe(caseId);
    expect(task.quotationId).toBe(quotationId);
    expect(
      (await prisma.motorQuotationCase.findUniqueOrThrow({ where: { id: caseId } }))
        .status,
    ).toBe(MotorCaseStatus.INSPECTION_REQUIRED);

    const photoSlots = [
      'front',
      'back',
      'left',
      'right',
      'windshield',
      'chassis',
      'odometer',
    ] as const;
    for (const slot of photoSlots) {
      await service.recordPhoto(
        inspectionId,
        slot,
        `e2e/${suffix}/${slot}.jpg`,
        actor(agentId, RoleType.AGENT),
      );
    }

    await service.submitForReview(inspectionId, actor(agentId, RoleType.AGENT));
    expect(
      (await prisma.motorQuotationCase.findUniqueOrThrow({ where: { id: caseId } }))
        .status,
    ).toBe(MotorCaseStatus.INSPECTION_SUBMITTED);
    expect(
      (await prisma.backOfficeTask.findUniqueOrThrow({ where: { id: taskId } })).status,
    ).toBe(BackOfficeTaskStatus.IN_REVIEW);

    await service.approveInspection(inspectionId, actor(backOfficeId, RoleType.BACK_OFFICE));

    const [inspection, motorCase, reviewTask, events, history] = await Promise.all([
      prisma.motorInspection.findUniqueOrThrow({ where: { id: inspectionId } }),
      prisma.motorQuotationCase.findUniqueOrThrow({ where: { id: caseId } }),
      prisma.backOfficeTask.findUniqueOrThrow({ where: { id: taskId } }),
      prisma.outboxEvent.findMany({ where: { aggregateId: inspectionId } }),
      prisma.motorInspectionHistory.findMany({ where: { inspectionId } }),
    ]);

    expect(inspection.status).toBe(InspectionStatus.COMPLETED);
    expect(motorCase.status).toBe(MotorCaseStatus.INSPECTION_APPROVED);
    expect(reviewTask.status).toBe(BackOfficeTaskStatus.COMPLETED);
    expect(events.map(({ eventType }) => eventType).sort()).toEqual([
      'inspection.approved',
      'inspection.required',
      'inspection.submitted',
    ]);
    expect(history.map(({ action }) => action)).toEqual(
      expect.arrayContaining(['CREATE', 'SUBMIT_FOR_REVIEW', 'APPROVE']),
    );
  });
});
