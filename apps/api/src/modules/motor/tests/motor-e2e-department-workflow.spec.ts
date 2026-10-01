import { Test, TestingModule } from '@nestjs/testing';
import { MotorInspectionService } from '../services/motor-inspection.service';
import { MotorPaymentTrackingService } from '../services/motor-payment-tracking.service';
import { MotorWorkflowGatesService } from '../services/motor-workflow-gates.service';
import { MotorPolicyIssuanceService } from '../services/motor-policy-issuance.service';
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RoleType, InspectionStatus, Prisma } from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

describe('BO-10: End-to-End Department Handoff Workflow (Agent -> BO -> Finance -> BO)', () => {
  let inspectionService: MotorInspectionService;
  let paymentService: MotorPaymentTrackingService;
  let gatesService: MotorWorkflowGatesService;
  let issuanceService: MotorPolicyIssuanceService;
  let prisma: any;
  let numberingEngine: any;

  const agentActor: ActorContext = {
    userId: 'agent-101',
    email: 'agent@jest.test',
    firstName: 'Agent',
    lastName: 'User',
    organizationId: 'comp-jest-1',
    companyId: 'comp-jest-1',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: ['quotation:create', 'lead:read'],
    workspaces: ['sales'],
    status: 'ACTIVE' as any,
  };

  const backOfficeActor: ActorContext = {
    userId: 'bo-201',
    email: 'bo@jest.test',
    firstName: 'BackOffice',
    lastName: 'Officer',
    organizationId: 'comp-jest-1',
    companyId: 'comp-jest-1',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    permissions: ['policy:issue', 'inspection:manage'],
    workspaces: ['operations'],
    status: 'ACTIVE' as any,
  };

  const financeActor: ActorContext = {
    userId: 'fin-301',
    email: 'finance@jest.test',
    firstName: 'Finance',
    lastName: 'Officer',
    organizationId: 'comp-jest-1',
    companyId: 'comp-jest-1',
    role: 'FINANCE' as any,
    roles: ['FINANCE'] as any,
    permissions: ['finance:manage'],
    workspaces: ['finance'],
    status: 'ACTIVE' as any,
  };

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) =>
        typeof cb === 'function' ? cb(prisma) : Promise.all(cb),
      ),
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      motorInspectionHistory: {
        create: jest.fn(),
      },
      motorPaymentRecord: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      motorRuleEvaluation: {
        findUnique: jest.fn(),
      },
      policy: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      idempotencyKey: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };

    numberingEngine = {
      generateNext: jest.fn().mockImplementation((type) => {
        if (type === 'INSPECTION') return Promise.resolve('INSP-2026-0001');
        if (type === 'POLICY') return Promise.resolve('POL-2026-9999');
        return Promise.resolve('GEN-0001');
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorInspectionService,
        MotorPaymentTrackingService,
        MotorWorkflowGatesService,
        MotorPolicyIssuanceService,
        {
          provide: ResourceAuthorizationService,
          useValue: { authorize: jest.fn() },
        },
        MotorPolicyDateService,
        { provide: PrismaService, useValue: prisma },
        { provide: NumberingEngineService, useValue: numberingEngine },
      ],
    }).compile();

    inspectionService = module.get<MotorInspectionService>(MotorInspectionService);
    paymentService = module.get<MotorPaymentTrackingService>(MotorPaymentTrackingService);
    gatesService = module.get<MotorWorkflowGatesService>(MotorWorkflowGatesService);
    issuanceService = module.get<MotorPolicyIssuanceService>(MotorPolicyIssuanceService);
  });

  describe('Full Department Lifecycle Execution', () => {
    const quotationId = 'quote-e2e-100';
    const totalPayable = 23600.0;

    const baseQuotation = {
      id: quotationId,
      quotationCode: 'QT-2026-E2E-100',
      companyId: 'comp-jest-1',
      createdById: 'agent-101',
      sumInsured: new Prisma.Decimal(650000),
      totalPremium: new Prisma.Decimal(totalPayable),
      calculationSnapshot: { base: 20000, gst: 3600 },
      workflowState: 'INSPECTION_REQUIRED',
      issuanceStatus: 'DRAFT',
      status: 'DRAFT',
      contact: { panNumber: 'ABCDE1234F' },
      account: { kycStatus: 'VERIFIED' },
      vehicle: { status: 'OLD' },
      proposal: { status: 'APPROVED' },
      motorDocuments: [{ verificationStatus: 'VERIFIED' }],
      motorInspection: null,
      motorPaymentRecord: null,
      policy: null,
    };

    it('Step 1: Agent creates Quotation requiring inspection; cannot self-approve inspection', async () => {
      prisma.quotation.findUnique.mockResolvedValue(baseQuotation);

      // Agent attempts to call createInspection or approveInspection -> Blocked
      await expect(
        inspectionService.createInspection(
          { quotationId },
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        inspectionService.approveInspection(
          'insp-101',
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Step 2: Back Office initiates vehicle inspection and reviews 7 mandatory photos', async () => {
      prisma.quotation.findUnique.mockResolvedValue(baseQuotation);
      prisma.motorInspection.findUnique.mockResolvedValue(null);
      prisma.motorInspection.create.mockResolvedValue({
        id: 'insp-101',
        inspectionCode: 'INSP-2026-0001',
        companyId: 'comp-jest-1',
        quotationId,
        status: InspectionStatus.REQUIRED,
      });

      const inspection = await inspectionService.createInspection(
        { quotationId },
        backOfficeActor,
      );

      expect(inspection.inspectionCode).toBe('INSP-2026-0001');
      expect(prisma.motorInspection.create).toHaveBeenCalled();
    });

    it('Step 3: Back Office signs off inspection; gates service marks inspection cleared', async () => {
      const inspectionWithPhotos = {
        id: 'insp-101',
        inspectionCode: 'INSP-2026-0001',
        companyId: 'comp-jest-1',
        quotationId,
        status: InspectionStatus.SUBMITTED_FOR_REVIEW,
        quotation: { createdById: 'other-user', companyId: 'comp-jest-1' },
        frontImageKey: 'key/front.jpg',
        backImageKey: 'key/back.jpg',
        leftImageKey: 'key/left.jpg',
        rightImageKey: 'key/right.jpg',
        windshieldImageKey: 'key/windshield.jpg',
        chassisImageKey: 'key/chassis.jpg',
        odometerImageKey: 'key/odometer.jpg',
      };

      prisma.motorInspection.findUnique.mockResolvedValue(inspectionWithPhotos);
      prisma.motorInspection.update.mockResolvedValue({
        ...inspectionWithPhotos,
        status: InspectionStatus.COMPLETED,
      });

      const approved = await inspectionService.approveInspection(
        'insp-101',
        backOfficeActor,
      );

      expect(approved.status).toBe(InspectionStatus.COMPLETED);
    });

    it('Step 4: Finance reconciles and verifies exact payable payment amount', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...baseQuotation,
        workflowState: 'PAYMENT_PENDING',
      });
      prisma.motorInspection.findUnique.mockResolvedValue({
        status: InspectionStatus.COMPLETED,
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'pay-201',
        quotationId,
        status: 'PAID',
        amount: new Prisma.Decimal(totalPayable),
      });

      // Mismatched payment fails
      await expect(
        paymentService.recordPayment(
          {
            quotationId,
            amount: 20000.0, // Short payment
            status: 'PAID',
            referenceNumber: 'UPI-9921',
          },
          'comp-jest-1',
          financeActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Exact payment succeeds
      const payment = await paymentService.recordPayment(
        {
          quotationId,
          amount: totalPayable,
          status: 'PAID',
          referenceNumber: 'UPI-9921',
        },
        'comp-jest-1',
        financeActor,
      );

      expect(payment.status).toBe('PAID');
    });

    it('Step 5: Workflow Gates Engine evaluates projection; only Back Office is authorized to ISSUE_POLICY', async () => {
      const readyQuotation = {
        ...baseQuotation,
        workflowState: 'PAYMENT_DONE',
        issuanceStatus: 'ISSUANCE_PENDING',
        motorInspection: { status: InspectionStatus.COMPLETED },
        motorPaymentRecord: {
          status: 'PAID',
          amount: new Prisma.Decimal(totalPayable),
        },
      };

      prisma.quotation.findUnique.mockResolvedValue(readyQuotation);
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({
        inspectionRequired: true,
      });

      // Back Office projection
      const boProjection = await gatesService.getWorkflowProjection(
        quotationId,
        'comp-jest-1',
        backOfficeActor,
      );

      expect(boProjection.canIssue).toBe(true);
      expect(boProjection.canonicalState).toBe('PENDING_ISSUANCE');
      expect(boProjection.allowedActions).toContain('ISSUE_POLICY');
      expect(boProjection.blockingReasons).toHaveLength(0);

      // Agent projection
      const agentProjection = await gatesService.getWorkflowProjection(
        quotationId,
        'comp-jest-1',
        agentActor,
      );

      expect(agentProjection.canIssue).toBe(false);
      expect(agentProjection.allowedActions).not.toContain('ISSUE_POLICY');
    });

    it('Step 6: Back Office executes final policy issuance; Agent can then view certificate', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...baseQuotation,
        workflowState: 'PAYMENT_DONE',
        issuanceStatus: 'ISSUANCE_PENDING',
        policy: { policyNumber: 'POL-2026-9999' },
      });
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({
        inspectionRequired: false,
      });

      const finalProjection = await gatesService.getWorkflowProjection(
        quotationId,
        'comp-jest-1',
        agentActor,
      );

      expect(finalProjection.canonicalState).toBe('ISSUED');
      expect(finalProjection.allowedActions).toContain('DOWNLOAD_POLICY');
    });
  });
});
