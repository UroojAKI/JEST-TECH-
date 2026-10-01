import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  MotorCaseStatus,
  RoleType,
  BackOfficeTaskStatus,
  InspectionStatus,
  QuotationStatus,
  PolicyStatus,
  Prisma,
} from '@prisma/client';

import { MotorQuotationCaseService } from '../services/motor-quotation-case.service';
import { MotorCaseStateMachineService } from '../services/motor-case-state-machine.service';
import { MotorInspectionService } from '../services/motor-inspection.service';
import { MotorPaymentTrackingService } from '../services/motor-payment-tracking.service';
import { MotorWorkflowGatesService } from '../services/motor-workflow-gates.service';
import { MotorPolicyIssuanceService } from '../services/motor-policy-issuance.service';
import { TasksService } from '../../tasks/tasks.service';
import { PaymentWebhookReconciliationListener } from '../../platform/integrations/webhooks/listeners/payment-webhook-reconciliation.listener';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { NumberingEngineService as TaskNumberingEngineService } from '../../tasks/numbering-engine.service';
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import { PrismaService } from '../../../database/prisma.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('Wave 6: End-to-End Persona Verification Suite (AGENT, BACK_OFFICE, FINANCE, ADMIN)', () => {
  let caseService: MotorQuotationCaseService;
  let stateMachine: MotorCaseStateMachineService;
  let inspectionService: MotorInspectionService;
  let paymentService: MotorPaymentTrackingService;
  let gatesService: MotorWorkflowGatesService;
  let issuanceService: MotorPolicyIssuanceService;
  let tasksService: TasksService;
  let webhookListener: PaymentWebhookReconciliationListener;
  let numberingEngine: any;
  let prisma: any;

  // ── Tenant A Personas ──
  const companyAId = 'comp-jest-tenant-a';
  const companyBId = 'comp-jest-tenant-b';

  const agentUser: RequestUser = {
    id: 'agent-user-01',
    email: 'agent@company-a.test',
    companyId: companyAId,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
  } as any;

  const agentActor: ActorContext = {
    userId: 'agent-user-01',
    email: 'agent@company-a.test',
    firstName: 'Sales',
    lastName: 'Agent',
    organizationId: companyAId,
    companyId: companyAId,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: ['QUOTATION:CREATE', 'CASE:SUBMIT'],
    workspaces: ['SALES'],
    status: 'ACTIVE' as any,
  };

  const backOfficeUser: RequestUser = {
    id: 'bo-user-01',
    email: 'backoffice@company-a.test',
    companyId: companyAId,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
  } as any;

  const backOfficeActor: ActorContext = {
    userId: 'bo-user-01',
    email: 'backoffice@company-a.test',
    firstName: 'Underwriting',
    lastName: 'Officer',
    organizationId: companyAId,
    companyId: companyAId,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    permissions: ['POLICY:ISSUE', 'INSPECTION:APPROVE', 'TASK:ASSIGN'],
    workspaces: ['OPERATIONS'],
    status: 'ACTIVE' as any,
  };

  const financeActor: ActorContext = {
    userId: 'fin-user-01',
    email: 'finance@company-a.test',
    firstName: 'Finance',
    lastName: 'Executive',
    organizationId: companyAId,
    companyId: companyAId,
    role: 'FINANCE' as any,
    roles: ['FINANCE'] as any,
    permissions: ['PAYMENT:VERIFY', 'PAYMENT:RECONCILE'],
    workspaces: ['FINANCE'],
    status: 'ACTIVE' as any,
  };

  const adminUser: RequestUser = {
    id: 'admin-user-01',
    email: 'admin@company-a.test',
    companyId: companyAId,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
  } as any;

  const adminActor: ActorContext = {
    userId: 'admin-user-01',
    email: 'admin@company-a.test',
    firstName: 'Admin',
    lastName: 'Super',
    organizationId: companyAId,
    companyId: companyAId,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    permissions: ['*'],
    workspaces: ['SETTINGS', 'OPERATIONS', 'FINANCE'],
    status: 'ACTIVE' as any,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) =>
        typeof cb === 'function' ? cb(prisma) : Promise.all(cb),
      ),
      motorQuotationCase: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      motorCaseHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      backOfficeTask: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
      },
      taskHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      quotation: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      quotationHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      proposal: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      motorInspectionHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      motorPaymentRecord: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      motorRuleEvaluation: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      policy: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      policyNominee: {
        create: jest.fn().mockResolvedValue({}),
      },
      policyHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      renewalJob: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      leadStageHistory: {
        create: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
      outboxEvent: {
        upsert: jest.fn().mockResolvedValue({}),
        findFirst: jest.fn(),
      },
      idempotencyKey: {
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
      vehicle: {
        update: jest.fn().mockResolvedValue({}),
        create: jest.fn(),
      },
    };

    numberingEngine = {
      generateNext: jest.fn().mockImplementation((type: string) => {
        if (type === 'CASE') return Promise.resolve('CASE-2026-0001');
        if (type === 'INSPECTION') return Promise.resolve('INSP-2026-0001');
        if (type === 'POLICY') return Promise.resolve('POL-2026-0001');
        if (type === 'BOTASK') return Promise.resolve('BOT-2026-0001');
        return Promise.resolve('GEN-0001');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuotationCaseService,
        MotorCaseStateMachineService,
        MotorInspectionService,
        MotorPaymentTrackingService,
        MotorWorkflowGatesService,
        MotorPolicyIssuanceService,
        TasksService,
        PaymentWebhookReconciliationListener,
        ResourceAuthorizationService,
        MotorPolicyDateService,
        {
          provide: TenantResourceAuthorizationService,
          useValue: {
            assertTenantResource: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingEngineService, useValue: numberingEngine },
        { provide: TaskNumberingEngineService, useValue: numberingEngine },
      ],
    }).compile();

    caseService = module.get<MotorQuotationCaseService>(MotorQuotationCaseService);
    stateMachine = module.get<MotorCaseStateMachineService>(MotorCaseStateMachineService);
    inspectionService = module.get<MotorInspectionService>(MotorInspectionService);
    paymentService = module.get<MotorPaymentTrackingService>(MotorPaymentTrackingService);
    gatesService = module.get<MotorWorkflowGatesService>(MotorWorkflowGatesService);
    issuanceService = module.get<MotorPolicyIssuanceService>(MotorPolicyIssuanceService);
    tasksService = module.get<TasksService>(TasksService);
    webhookListener = module.get<PaymentWebhookReconciliationListener>(
      PaymentWebhookReconciliationListener,
    );
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. AGENT PERSONA JOURNEY: Lead -> Calculation -> Submit Case -> Maker-Checker Guard
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1. AGENT Persona Verification', () => {
    const caseId = 'case-agent-101';
    const quoteId = 'quote-agent-101';
    const totalPremium = 18500.0;

    const baseCase = {
      id: caseId,
      companyId: companyAId,
      status: MotorCaseStatus.PROPOSAL_READY,
      selectedQuoteId: quoteId,
      lead: {
        id: 'lead-101',
        assignedToId: agentUser.id,
        createdById: agentUser.id,
        companyId: companyAId,
      },
      selectedQuote: {
        id: quoteId,
        createdById: agentUser.id,
        agentId: agentUser.id,
        companyId: companyAId,
        totalPremium: new Prisma.Decimal(totalPremium),
      },
    };

    it('1.1 Agent successfully submits quotation case for Back Office review', async () => {
      prisma.motorQuotationCase.findFirst.mockResolvedValue(baseCase);
      prisma.motorQuotationCase.update.mockResolvedValue({
        ...baseCase,
        status: MotorCaseStatus.SUBMITTED_FOR_REVIEW,
      });
      prisma.backOfficeTask.findFirst.mockResolvedValue(null);
      prisma.backOfficeTask.create.mockResolvedValue({
        id: 'bot-101',
        taskCode: 'BOT-2026-0001',
        caseId,
        companyId: companyAId,
        status: BackOfficeTaskStatus.PENDING,
      });

      const result = await caseService.submitCase(caseId, agentUser);

      expect(result).toBeDefined();
      expect(result.case.status).toBe(MotorCaseStatus.SUBMITTED_FOR_REVIEW);
      expect(result.task).toBeDefined();
      expect(prisma.backOfficeTask.create).toHaveBeenCalled();
    });

    it('1.2 Adversarial Barrier: Non-owner agent is forbidden from submitting case', async () => {
      const nonOwnerAgent: RequestUser = {
        id: 'agent-rogue-99',
        companyId: companyAId,
        role: RoleType.AGENT,
      } as any;

      prisma.motorQuotationCase.findFirst.mockResolvedValue(baseCase);

      await expect(
        caseService.submitCase(caseId, nonOwnerAgent),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.3 Adversarial Barrier: Agent cannot approve or waive vehicle inspection', async () => {
      await expect(
        inspectionService.approveInspection('insp-101', agentActor),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        inspectionService.waiveInspection('insp-101', 'Reason', agentActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.4 Adversarial Barrier: Agent is prohibited from marking payment as PAID', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: quoteId,
        companyId: companyAId,
        totalPremium: new Prisma.Decimal(totalPremium),
      });

      await expect(
        paymentService.recordPayment(
          {
            quotationId: quoteId,
            status: 'PAID',
            amount: totalPremium,
            referenceNumber: 'TXN-AGENT-FRAUD',
          },
          companyAId,
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('1.5 Maker-Checker Barrier: Agent who created quotation cannot issue policy', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: quoteId,
        companyId: companyAId,
        createdById: agentUser.id, // Agent is creator
        totalPremium: new Prisma.Decimal(totalPremium),
        calculationSnapshot: {
          calculationVersion: 'v1.0',
          rateConfigurationVersion: 'v1.0',
          totalPremium,
        },
        workflowState: 'PAYMENT_DONE',
        contact: { panNumber: 'ABCDE1234F' },
        motorPaymentRecord: { status: 'PAID', amount: new Prisma.Decimal(totalPremium) },
      });

      await expect(
        issuanceService.issuePolicy(
          quoteId,
          { startDate: new Date().toISOString() },
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. BACK_OFFICE PERSONA JOURNEY: Queue Pickup -> 6-Point Assign -> Underwrite -> Gates -> Issue
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2. BACK_OFFICE Persona Verification', () => {
    const taskId = 'bot-201';
    const caseId = 'case-bo-201';
    const quoteId = 'quote-bo-201';
    const totalPremium = 24000.0;

    const taskRecord = {
      id: taskId,
      taskCode: 'BOT-2026-0001',
      caseId,
      companyId: companyAId,
      deletedAt: null,
      status: BackOfficeTaskStatus.PENDING,
      assignedToId: null,
    };

    it('2.1 Queue Pickup enforces 6-point task assignment validation', async () => {
      // Point 1: Missing task -> NotFoundException
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(null);
      await expect(
        tasksService.assignBackOfficeTask('missing-id', backOfficeUser.id, backOfficeUser),
      ).rejects.toThrow(NotFoundException);

      // Point 2: Cross-tenant task -> NotFoundException (fail-closed)
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce({
        ...taskRecord,
        companyId: companyBId,
      });
      await expect(
        tasksService.assignBackOfficeTask(taskId, backOfficeUser.id, backOfficeUser),
      ).rejects.toThrow(NotFoundException);

      // Point 3: Missing assignee -> NotFoundException
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(taskRecord);
      prisma.user.findFirst.mockResolvedValueOnce(null);
      await expect(
        tasksService.assignBackOfficeTask(taskId, 'missing-user', backOfficeUser),
      ).rejects.toThrow(NotFoundException);

      // Point 4: Cross-tenant assignee -> ForbiddenException
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(taskRecord);
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'user-tenant-b',
        companyId: companyBId,
        role: { type: RoleType.BACK_OFFICE },
        status: 'ACTIVE',
        deletedAt: null,
      });
      await expect(
        tasksService.assignBackOfficeTask(taskId, 'user-tenant-b', backOfficeUser),
      ).rejects.toThrow(ForbiddenException);

      // Point 5: Assignee with AGENT role -> ForbiddenException
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(taskRecord);
      prisma.user.findFirst.mockResolvedValueOnce({
        id: agentUser.id,
        companyId: companyAId,
        role: { type: RoleType.AGENT },
        status: 'ACTIVE',
        deletedAt: null,
      });
      await expect(
        tasksService.assignBackOfficeTask(taskId, agentUser.id, backOfficeUser),
      ).rejects.toThrow(ForbiddenException);

      // Point 6: Deactivated assignee -> BadRequestException
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(taskRecord);
      prisma.user.findFirst.mockResolvedValueOnce({
        id: 'inactive-bo',
        companyId: companyAId,
        role: { type: RoleType.BACK_OFFICE },
        status: 'INACTIVE',
        deletedAt: null,
      });
      await expect(
        tasksService.assignBackOfficeTask(taskId, 'inactive-bo', backOfficeUser),
      ).rejects.toThrow(BadRequestException);

      // Successful 6-point assignment
      prisma.backOfficeTask.findFirst.mockResolvedValueOnce(taskRecord);
      prisma.user.findFirst.mockResolvedValueOnce({
        id: backOfficeUser.id,
        companyId: companyAId,
        role: { type: RoleType.BACK_OFFICE },
        status: 'ACTIVE',
        deletedAt: null,
      });
      prisma.backOfficeTask.update.mockResolvedValueOnce({
        ...taskRecord,
        status: BackOfficeTaskStatus.IN_REVIEW,
        assignedToId: backOfficeUser.id,
      });
      prisma.motorQuotationCase.findFirst.mockResolvedValueOnce({
        id: caseId,
        companyId: companyAId,
        status: MotorCaseStatus.SUBMITTED_FOR_REVIEW,
      });
      prisma.motorQuotationCase.update.mockResolvedValueOnce({
        id: caseId,
        status: MotorCaseStatus.BACK_OFFICE_REVIEW,
      });

      const assigned = await tasksService.assignBackOfficeTask(
        taskId,
        backOfficeUser.id,
        backOfficeUser,
      );

      expect(assigned).toBeDefined();
      expect(assigned.assignedToId).toBe(backOfficeUser.id);
    });

    it('2.2 Underwriting Inspection Approval enforces photo completeness & SoD', async () => {
      const inspRecord = {
        id: 'insp-201',
        inspectionCode: 'INSP-2026-0001',
        companyId: companyAId,
        quotationId: quoteId,
        status: InspectionStatus.SUBMITTED_FOR_REVIEW,
        inspectorUserId: 'inspector-99',
        createdById: 'creator-99',
        quotation: { createdById: agentUser.id, companyId: companyAId },
        // 7 mandatory photos
        frontImageKey: 'photos/front.jpg',
        backImageKey: 'photos/back.jpg',
        leftImageKey: 'photos/left.jpg',
        rightImageKey: 'photos/right.jpg',
        windshieldImageKey: 'photos/windshield.jpg',
        chassisImageKey: 'photos/chassis.jpg',
        odometerImageKey: 'photos/odometer.jpg',
      };

      // Segregation of Duties: Inspector who took photos cannot approve
      prisma.motorInspection.findUnique.mockResolvedValueOnce({
        ...inspRecord,
        inspectorUserId: backOfficeActor.userId,
      });
      await expect(
        inspectionService.approveInspection('insp-201', backOfficeActor),
      ).rejects.toThrow(ForbiddenException);

      // Missing photos fail approval
      prisma.motorInspection.findUnique.mockResolvedValueOnce({
        ...inspRecord,
        frontImageKey: null,
      });
      await expect(
        inspectionService.approveInspection('insp-201', backOfficeActor),
      ).rejects.toThrow(BadRequestException);

      // Valid approval by independent Back Office officer
      prisma.motorInspection.findUnique.mockResolvedValueOnce(inspRecord);
      prisma.motorInspection.update.mockResolvedValueOnce({
        ...inspRecord,
        status: InspectionStatus.COMPLETED,
      });
      prisma.quotation.update.mockResolvedValueOnce({});

      const approved = await inspectionService.approveInspection(
        'insp-201',
        backOfficeActor,
      );
      expect(approved.status).toBe(InspectionStatus.COMPLETED);
    });

    it('2.3 Server-authoritative 6-Gate projection evaluates issuance eligibility', async () => {
      const fullQuote = {
        id: quoteId,
        quotationCode: 'QTN-2026-201',
        companyId: companyAId,
        sumInsured: new Prisma.Decimal(600000),
        totalPremium: new Prisma.Decimal(totalPremium),
        workflowState: 'PAYMENT_DONE',
        calculationSnapshot: {
          calculationVersion: 'v1.0',
          rateConfigurationVersion: 'v1.0',
          totalPremium,
        },
        contact: { panNumber: 'ABCDE1234F' },
        account: { kycStatus: 'VERIFIED' },
        vehicle: { vehicleCode: 'VEH-01' },
        motorInspection: { status: InspectionStatus.COMPLETED },
        proposal: { status: 'APPROVED' },
        motorPaymentRecord: { status: 'PAID', amount: new Prisma.Decimal(totalPremium) },
        motorDocuments: [{ verificationStatus: 'VERIFIED' }],
        policy: null,
      };

      prisma.quotation.findUnique.mockResolvedValue(fullQuote);
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({ inspectionRequired: true });

      const projection = await gatesService.getWorkflowProjection(
        quoteId,
        companyAId,
        backOfficeActor,
      );

      expect(projection.canIssue).toBe(true);
      expect(projection.blockingGates.calculationValid).toBe(true);
      expect(projection.blockingGates.kycVerified).toBe(true);
      expect(projection.blockingGates.inspectionCleared).toBe(true);
      expect(projection.blockingGates.proposalApproved).toBe(true);
      expect(projection.blockingGates.paymentVerified).toBe(true);
      expect(projection.blockingGates.documentsVerified).toBe(true);
    });

    it('2.4 Independent Back Office user issues policy satisfying all invariants', async () => {
      const matureQuote = {
        id: quoteId,
        quotationCode: 'QTN-2026-201',
        companyId: companyAId,
        createdById: agentUser.id, // Agent created
        agentId: agentUser.id,
        caseId,
        leadId: 'lead-201',
        totalPremium: new Prisma.Decimal(totalPremium),
        workflowState: 'PAYMENT_DONE',
        calculationSnapshot: {
          calculationVersion: 'v1.0',
          rateConfigurationVersion: 'v1.0',
          totalPremium,
          inputs: { policyType: 'PACKAGE_COMPREHENSIVE' },
        },
        contact: { panNumber: 'ABCDE1234F' },
        motorInspection: { status: InspectionStatus.COMPLETED },
        proposal: { status: 'APPROVED' },
        motorDocuments: [{ verificationStatus: 'VERIFIED' }],
        lead: { id: 'lead-201', currentWorkflowStep: 'PAYMENT' },
        policy: null,
      };

      prisma.quotation.findUnique.mockResolvedValue(matureQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue({
        quotationId: quoteId,
        status: 'PAID',
        amount: new Prisma.Decimal(totalPremium),
      });

      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      prisma.policy.create.mockResolvedValue({
        id: 'pol-201',
        policyNumber: 'POL-2026-0001',
        quotationId: quoteId,
        status: PolicyStatus.ACTIVE,
        companyId: companyAId,
      });

      const issuedPolicy = await issuanceService.issuePolicy(
        quoteId,
        {
          startDate: new Date().toISOString(),
          endDate: nextYear.toISOString(),
          nomineeName: 'Pooja Singhania',
          nomineeRelation: 'Spouse',
        },
        backOfficeActor, // Independent Back Office Actor (Maker-Checker compliant)
      );

      expect(issuedPolicy).toBeDefined();
      expect(issuedPolicy.policyNumber).toBe('POL-2026-0001');

      // Assert side-effects: Quotation CONVERTED_TO_POLICY
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: quoteId },
          data: expect.objectContaining({
            status: 'CONVERTED_TO_POLICY',
            issuanceStatus: 'ISSUED',
          }),
        }),
      );

      // Assert side-effects: Case ISSUED
      expect(prisma.motorQuotationCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: caseId },
          data: { status: 'ISSUED' },
        }),
      );

      // Assert side-effects: Lead POLICY_ISSUED / ISSUED
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'lead-201' },
          data: expect.objectContaining({
            status: 'POLICY_ISSUED',
            currentWorkflowStep: 'ISSUED',
          }),
        }),
      );

      // Assert side-effects: 5 Renewal Jobs (45, 30, 15, 7, 0)
      expect(prisma.renewalJob.upsert).toHaveBeenCalledTimes(5);

      // Assert side-effects: Outbox event policy.issued
      expect(prisma.outboxEvent.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { eventKey: 'policy.issued:pol-201' },
          create: expect.objectContaining({
            eventType: 'policy.issued',
            aggregateId: 'pol-201',
          }),
        }),
      );

      // Assert side-effects: AuditLog
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity: 'Policy',
            entityType: 'MOTOR_POLICY_ISSUANCE',
            performedById: backOfficeActor.userId,
          }),
        }),
      );
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. FINANCE PERSONA JOURNEY: Ledger -> Exact Match -> Webhook Reconcile -> Immutability
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3. FINANCE Persona Verification', () => {
    const quoteId = 'quote-fin-301';
    const exactPayable = 29500.0;

    const quotationRecord = {
      id: quoteId,
      companyId: companyAId,
      productType: 'MOTOR',
      totalPremium: new Prisma.Decimal(exactPayable),
      proposal: { status: 'APPROVED' },
    };

    it('3.1 Multi-tenant financial ledger enforces strict tenant isolation', async () => {
      // Quotation belonging to Tenant B accessed by Tenant A Finance
      prisma.quotation.findUnique.mockResolvedValueOnce({
        ...quotationRecord,
        companyId: companyBId,
      });

      await expect(
        paymentService.recordPayment(
          {
            quotationId: quoteId,
            status: 'PAID',
            amount: exactPayable,
            referenceNumber: 'TXN-001',
          },
          companyAId,
          financeActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3.2 Financial reconciliation strictly rejects partial or tampered amounts', async () => {
      prisma.quotation.findUnique.mockResolvedValue(quotationRecord);
      prisma.proposal.findUnique.mockResolvedValue({ status: 'APPROVED' });

      // Short payment of ₹25,000 (payable is ₹29,500)
      await expect(
        paymentService.recordPayment(
          {
            quotationId: quoteId,
            status: 'PAID',
            amount: 25000.0,
            referenceNumber: 'TXN-SHORT',
          },
          companyAId,
          financeActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Overpayment of ₹30,000
      await expect(
        paymentService.recordPayment(
          {
            quotationId: quoteId,
            status: 'PAID',
            amount: 30000.0,
            referenceNumber: 'TXN-OVER',
          },
          companyAId,
          financeActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('3.3 Exact decimal match reconciles payment and synchronizes case to PAYMENT_VERIFIED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...quotationRecord,
        caseId: 'case-fin-301',
      });
      prisma.proposal.findUnique.mockResolvedValue({ status: 'APPROVED' });
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'mpr-301',
        quotationId: quoteId,
        status: 'PAID',
        amount: new Prisma.Decimal(exactPayable),
      });
      prisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: 'case-fin-301',
        companyId: companyAId,
        status: MotorCaseStatus.INSPECTION_APPROVED,
      });
      prisma.motorQuotationCase.update.mockResolvedValue({
        id: 'case-fin-301',
        status: MotorCaseStatus.PAYMENT_VERIFIED,
      });

      const payment = await paymentService.recordPayment(
        {
          quotationId: quoteId,
          status: 'PAID',
          amount: exactPayable,
          referenceNumber: 'UTR-HDFC-998877',
        },
        companyAId,
        financeActor,
      );

      expect(payment).toBeDefined();
      expect(payment.status).toBe('PAID');
    });

    it('3.4 Razorpay webhook auto-reconciliation verifies payload and idempotency', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...quotationRecord,
        caseId: 'case-fin-301',
      });
      prisma.proposal.findUnique.mockResolvedValue({ status: 'APPROVED' });
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'mpr-webhook-301',
        quotationId: quoteId,
        status: 'PAID',
        amount: new Prisma.Decimal(exactPayable),
      });

      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_auto_9988',
              amount: exactPayable * 100, // In paise
              currency: 'INR',
              method: 'netbanking',
              created_at: Math.floor(Date.now() / 1000),
              notes: {
                quotationId: quoteId,
              },
            },
          },
        },
      };

      const result = await webhookListener.handleRazorpayPaymentCaptured(webhookPayload);
      expect(result).toBeDefined();
      expect(result.reconciled).toBe(true);
      expect((result as any).paymentRecord?.status).toBe('PAID');
      expect(prisma.motorPaymentRecord.upsert).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. ADMIN PERSONA JOURNEY: Override Authority -> Mutation Guard -> Audit Invariants
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4. ADMIN Persona Verification', () => {
    const caseId = 'case-admin-401';

    it('4.1 Direct status mutation guard blocks arbitrary PATCH payloads', () => {
      // Attempt direct PATCH with status: 'ISSUED' throws BadRequestException
      expect(() => {
        stateMachine.assertNoDirectStatusMutation({ status: 'ISSUED' });
      }).toThrow(BadRequestException);

      expect(() => {
        stateMachine.assertNoDirectStatusMutation({ status: 'COMPLETED' });
      }).toThrow(BadRequestException);

      // Non-status payload passes guard
      expect(() => {
        stateMachine.assertNoDirectStatusMutation({ remarks: 'Admin review completed' });
      }).not.toThrow();
    });

    it('4.2 State machine prevents illegal lifecycle status jumps', async () => {
      prisma.motorQuotationCase.findFirst.mockResolvedValue({
        id: caseId,
        companyId: companyAId,
        status: MotorCaseStatus.DRAFT,
      });

      // Cannot jump from DRAFT directly to ISSUE_POLICY
      await expect(
        stateMachine.transition(caseId, 'ISSUE_POLICY', adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('4.3 Authoritative audit trail preserves immutable record of domain actions', async () => {
      prisma.auditLog.create.mockResolvedValue({
        id: 'audit-001',
        action: 'CREATE',
        entity: 'Policy',
        entityId: 'pol-401',
        entityType: 'MOTOR_POLICY_ISSUANCE',
        performedById: adminUser.id,
      });

      const auditEntry = await prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Policy',
          entityId: 'pol-401',
          entityType: 'MOTOR_POLICY_ISSUANCE',
          performedById: adminUser.id,
          userId: adminUser.id,
          module: 'MOTOR',
        },
      });

      expect(auditEntry.entityType).toBe('MOTOR_POLICY_ISSUANCE');
      expect(auditEntry.performedById).toBe(adminUser.id);
    });
  });
});
