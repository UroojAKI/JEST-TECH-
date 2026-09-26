import { Test, TestingModule } from '@nestjs/testing';
import { MotorPolicyIssuanceService } from './motor-policy-issuance.service';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { RoleType, UserStatus } from '@prisma/client';
import {
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

describe('MotorPolicyIssuanceService (Iteration 8)', () => {
  let service: MotorPolicyIssuanceService;
  let prisma: any;
  let paymentService: any;
  let authzService: ResourceAuthorizationService;
  let numberingService: any;

  beforeEach(async () => {
    authzService = new ResourceAuthorizationService();
    paymentService = {
      canProceedToPolicy: jest.fn(),
    };
    numberingService = {
      generateNext: jest.fn().mockImplementation((entityType: string) => {
        if (entityType === 'POLICY') return Promise.resolve('POL-2026-000001');
        if (entityType === 'VEHICLE') return Promise.resolve('VEH-2026-000001');
        return Promise.resolve('SEQ-000001');
      }),
    };
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      policy: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      policyHistory: {
        create: jest.fn(),
      },
      policyNominee: {
        create: jest.fn(),
      },
      quotationHistory: {
        create: jest.fn(),
      },
      renewalJob: {
        upsert: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      outboxEvent: {
        upsert: jest.fn(),
      },
      motorPaymentRecord: {
        findUnique: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
      },
      vehicle: {
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 'veh-1' }),
      },
      lead: {
        update: jest.fn(),
      },
      leadStageHistory: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorPolicyIssuanceService,
        { provide: PrismaService, useValue: prisma },
        { provide: MotorPaymentTrackingService, useValue: paymentService },
        { provide: ResourceAuthorizationService, useValue: authzService },
        { provide: NumberingEngineService, useValue: numberingService },
      ],
    }).compile();

    service = module.get<MotorPolicyIssuanceService>(
      MotorPolicyIssuanceService,
    );
  });

  const createActor = (role: RoleType): ActorContext => ({
    userId: 'usr-actor-1',
    email: 'user@jest.com',
    firstName: 'User',
    lastName: 'One',
    organizationId: 'org-1',
    companyId: 'org-1',
    role,
    roles: [role],
    permissions: [],
    workspaces: ['BACK_OFFICE'],
    status: UserStatus.ACTIVE,
  });

  const validDto = {
    actualPolicyNumber: 'POL-HDFC-999888',
    actualPremium: 17638.88,
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2027-08-31T23:59:59.000Z',
  };

  const validQuote = {
    id: 'q-100',
    companyId: 'org-1',
    quotationCode: 'QTN-000100',
    contactId: 'c-100',
    totalPremium: 17638.88,
    policy: null,
    workflowState: 'PAYMENT_DONE',
    calculationSnapshot: {
      calculationVersion: '1.0.0',
      rateConfigurationVersion: '1.0.0',
      totalPremium: 17638.88,
      inputs: { policyType: 'PACKAGE_COMPREHENSIVE', tpTenure: 1 },
    },
    motorMetadata: {},
    motorInspection: null,
  };

  describe('issuePolicy', () => {
    it('should successfully issue policy and schedule renewal when called by OPERATIONS', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      paymentService.canProceedToPolicy.mockResolvedValue({
        allowed: true,
        blockers: [],
      });
      prisma.quotation.findUnique.mockResolvedValue(validQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue({
        quotationId: 'q-100',
        status: 'PAID',
        amount: 17638.88,
      });
      prisma.policy.create.mockResolvedValue({
        id: 'pol-1',
        policyNumber: 'POL-HDFC-999888',
        status: 'ACTIVE',
      });

      const policy = await service.issuePolicy('q-100', validDto, opsActor);

      expect(policy).toBeDefined();
      expect(prisma.policy.create).toHaveBeenCalled();
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            issuanceStatus: 'ISSUED',
            status: 'CONVERTED_TO_POLICY',
          }),
        }),
      );
      // Verify durable renewal scheduled across 5 offsets (45, 30, 15, 7, 0)
      expect(prisma.renewalJob.upsert).toHaveBeenCalledTimes(5);
    });

    it('should reject policy issuance when attempted by unauthorized role', async () => {
      const viewerActor = createActor(RoleType.AGENT);

      await expect(
        service.issuePolicy('q-100', validDto, viewerActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should block policy issuance when payment gate fails', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      prisma.quotation.findUnique.mockResolvedValue(validQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue({
        quotationId: 'q-100',
        status: 'PENDING',
        amount: 0,
      });

      await expect(
        service.issuePolicy('q-100', validDto, opsActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject policy issuance with invalid date range', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      const invalidDateDto = {
        ...validDto,
        startDate: '2027-01-01',
        endDate: '2026-01-01', // End before start!
      };

      await expect(
        service.issuePolicy('q-100', invalidDateDto, opsActor),
      ).rejects.toThrow(BadRequestException);
    });

    it('PHASE 14: should safely reconcile state on crash recovery when policy exists with matching financials', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      const recoveredQuote = {
        ...validQuote,
        policy: {
          id: 'pol-recovered-1',
          policyNumber: 'POL-REC-001',
          premiumAmount: 17638.88,
          startDate: new Date('2026-09-26'),
        },
      };
      prisma.quotation.findUnique.mockResolvedValue(recoveredQuote);

      const policy = await service.issuePolicy('q-100', validDto, opsActor);

      expect(policy.id).toBe('pol-recovered-1');
      expect(prisma.policy.create).not.toHaveBeenCalled();
      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q-100' },
          data: expect.objectContaining({
            issuanceStatus: 'ISSUED',
            status: 'CONVERTED_TO_POLICY',
          }),
        }),
      );
    });

    it('PHASE 14: should transition quotation to ISSUANCE_MANUAL_REVIEW if existing policy has financial mismatch', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      const mismatchedQuote = {
        ...validQuote,
        policy: {
          id: 'pol-mismatch-1',
          policyNumber: 'POL-MIS-001',
          premiumAmount: 9999.00, // Mismatched! Expected: 17638.88
          startDate: new Date('2026-09-26'),
        },
      };
      prisma.quotation.findUnique.mockResolvedValue(mismatchedQuote);

      await expect(
        service.issuePolicy('q-100', validDto, opsActor),
      ).rejects.toThrow('CRASH_RECOVERY_MISMATCH');

      expect(prisma.quotation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'q-100' },
          data: expect.objectContaining({
            workflowState: 'ISSUANCE_MANUAL_REVIEW',
          }),
        }),
      );
    });

    it('PHASE 14: should reject when quotation is locked in ISSUANCE_IN_PROGRESS within lock TTL', async () => {
      const opsActor = createActor(RoleType.BACK_OFFICE);
      const lockedQuote = {
        ...validQuote,
        workflowState: 'ISSUANCE_IN_PROGRESS',
        updatedAt: new Date(Date.now() - 60 * 1000), // Updated 1 min ago (lock active)
      };
      prisma.quotation.findUnique.mockResolvedValue(lockedQuote);
      prisma.policy.findFirst.mockResolvedValue(null);

      await expect(
        service.issuePolicy('q-100', validDto, opsActor),
      ).rejects.toThrow('ISSUANCE_IN_PROGRESS');
    });
  });
});
