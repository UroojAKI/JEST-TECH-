import { Test, TestingModule } from '@nestjs/testing';
import { MotorPolicyIssuanceService } from './motor-policy-issuance.service';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { PrismaService } from '../../../database/prisma.service';
import { RoleType, UserStatus } from '@prisma/client';
import { ForbiddenException, ConflictException, BadRequestException } from '@nestjs/common';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';

describe('MotorPolicyIssuanceService (Iteration 8)', () => {
  let service: MotorPolicyIssuanceService;
  let prisma: any;
  let paymentService: any;
  let authzService: ResourceAuthorizationService;

  beforeEach(async () => {
    authzService = new ResourceAuthorizationService();
    paymentService = {
      canProceedToPolicy: jest.fn(),
    };
    prisma = {
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      policy: {
        create: jest.fn(),
      },
      policyHistory: {
        create: jest.fn(),
      },
      quotationHistory: {
        create: jest.fn(),
      },
      renewalTask: {
        create: jest.fn(),
      },
      auditLog: {
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
      ],
    }).compile();

    service = module.get<MotorPolicyIssuanceService>(MotorPolicyIssuanceService);
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
    quotationCode: 'QTN-000100',
    contactId: 'c-100',
    totalPremium: 17638.88,
    policy: null,
    workflowState: 'PAYMENT_DONE',
    calculationSnapshot: { inputs: { policyType: 'PACKAGE_COMPREHENSIVE', tpTenure: 1 } },
  };

  describe('issuePolicy', () => {
    it('should successfully issue policy and schedule renewal when called by OPERATIONS', async () => {
      const opsActor = createActor(RoleType.POLICY_ISSUANCE_EXECUTIVE);
      paymentService.canProceedToPolicy.mockResolvedValue({ allowed: true, blockers: [] });
      prisma.quotation.findUnique.mockResolvedValue(validQuote);
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
      // Verify renewal scheduled
      expect(prisma.renewalTask.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            policyId: 'pol-1',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should reject policy issuance when attempted by SALES_AGENT', async () => {
      const salesActor = createActor(RoleType.SALES_AGENT);

      await expect(
        service.issuePolicy('q-100', validDto, salesActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should block policy issuance when payment gate fails', async () => {
      const opsActor = createActor(RoleType.OPERATIONS);
      paymentService.canProceedToPolicy.mockResolvedValue({
        allowed: false,
        blockers: ['PAYMENT_NOT_CONFIRMED'],
      });

      await expect(
        service.issuePolicy('q-100', validDto, opsActor),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject policy issuance with invalid date range', async () => {
      const opsActor = createActor(RoleType.OPERATIONS);
      const invalidDateDto = {
        ...validDto,
        startDate: '2027-01-01',
        endDate: '2026-01-01', // End before start!
      };

      await expect(
        service.issuePolicy('q-100', invalidDateDto, opsActor),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
