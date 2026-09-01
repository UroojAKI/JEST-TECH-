import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PolicyStatus, RoleType, UserStatus } from '@prisma/client';

import { PoliciesController } from '../controllers/policies.controller';
import { CancelPolicyService } from '../services/commands/cancel-policy.service';
import { RenewPolicyService } from '../services/commands/renew-policy.service';
import { GetPolicyService } from '../services/queries/get-policy.service';
import { GetPolicyHistoryService } from '../services/queries/get-policy-history.service';
import { PrismaService } from '../../../database/prisma.service';
import { RenewalEngineService } from '../services/renewal-engine.service';
import { RenewalSchedulerCron } from '../crons/renewal-scheduler.cron';
import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { BackOfficeQueueService } from '../services/queries/back-office-queue.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('PoliciesController', () => {
  let controller: PoliciesController;
  let cancelService: CancelPolicyService;
  let renewService: RenewPolicyService;
  let getService: GetPolicyService;
  let historyService: GetPolicyHistoryService;
  let backOfficeQueueService: BackOfficeQueueService;
  let issuePolicyService: IssuePolicyService;

  const mockUser: RequestUser = {
    id: 'user-123',
    userId: 'user-123',
    email: 'underwriter@jestpolicy.com',
    role: RoleType.UNDERWRITER,
    firstName: 'Test',
    lastName: 'Underwriter',
    organizationId: 'org-1',
    companyId: 'org-1',
    branchId: 'branch-1',
    teamId: 'team-1',
    roles: [RoleType.UNDERWRITER],
    permissions: ['POLICIES_READ', 'POLICIES_WRITE'],
    workspaces: ['OPERATIONS'],
    status: UserStatus.ACTIVE,
  };

  const mockPolicyResponse = {
    id: 'policy-123',
    policyNumber: 'POL-000001',
    status: PolicyStatus.ACTIVE,
    quotationId: 'quote-123',
    contactId: 'contact-123',
    accountId: null,
    premiumAmount: 11800,
    effectiveDate: new Date(),
    expiryDate: new Date(),
    createdById: 'user-123',
    updatedById: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoliciesController],
      providers: [
        {
          provide: CancelPolicyService,
          useValue: {
            execute: jest.fn().mockResolvedValue({
              ...mockPolicyResponse,
              status: PolicyStatus.CANCELLED,
            }),
          },
        },
        {
          provide: RenewPolicyService,
          useValue: {
            execute: jest.fn().mockResolvedValue(mockPolicyResponse),
          },
        },
        {
          provide: GetPolicyService,
          useValue: {
            executeOne: jest.fn().mockResolvedValue(mockPolicyResponse),
            executeAll: jest.fn().mockResolvedValue([mockPolicyResponse]),
          },
        },
        {
          provide: GetPolicyHistoryService,
          useValue: { execute: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: PrismaService,
          useValue: {
            policy: {
              findMany: jest.fn().mockResolvedValue([mockPolicyResponse]),
              count: jest.fn().mockResolvedValue(1),
            },
          },
        },
        {
          provide: RenewalEngineService,
          useValue: {
            getRenewalKpis: jest.fn().mockResolvedValue({}),
            getRenewalQueue: jest.fn().mockResolvedValue([]),
            getRenewalPipeline: jest.fn().mockResolvedValue([]),
            triggerManualReminder: jest
              .fn()
              .mockResolvedValue({ success: true }),
            escalateRenewal: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: RenewalSchedulerCron,
          useValue: {
            runManually: jest.fn().mockResolvedValue({ triggered: true }),
          },
        },
        {
          provide: IssuePolicyService,
          useValue: {
            execute: jest.fn().mockResolvedValue(mockPolicyResponse),
          },
        },
        {
          provide: BackOfficeQueueService,
          useValue: {
            validateIssuanceGates: jest.fn().mockResolvedValue({ allowed: true }),
          },
        },
      ],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
    cancelService = module.get<CancelPolicyService>(CancelPolicyService);
    renewService = module.get<RenewPolicyService>(RenewPolicyService);
    getService = module.get<GetPolicyService>(GetPolicyService);
    historyService = module.get<GetPolicyHistoryService>(
      GetPolicyHistoryService,
    );
    backOfficeQueueService = module.get<BackOfficeQueueService>(
      BackOfficeQueueService,
    );
    issuePolicyService = module.get<IssuePolicyService>(
      IssuePolicyService,
    );
  });

  describe('Happy Path', () => {
    it('should find one policy', async () => {
      const result = await controller.findOne('policy-123', mockUser);
      expect(result).toEqual(mockPolicyResponse);
      expect(getService.executeOne).toHaveBeenCalledWith(
        'policy-123',
        mockUser,
      );
    });

    it('should cancel a policy', async () => {
      const result = await controller.cancel(
        'policy-123',
        'Customer request',
        mockUser,
      );
      expect(cancelService.execute).toHaveBeenCalledWith(
        'policy-123',
        'Customer request',
        mockUser.id,
      );
    });

    it('should issue policy directly through validateIssuanceGates and IssuePolicyService via POST /policies/issue', async () => {
      const dto = { quotationId: 'quote-100', issueSource: 'DIRECT_ISSUANCE' };

      const result = await controller.issuePolicyDirect(dto, mockUser);
      expect(backOfficeQueueService.validateIssuanceGates).toHaveBeenCalledWith('quote-100');
      expect(issuePolicyService.execute).toHaveBeenCalledWith(
        expect.objectContaining({ quotationId: 'quote-100' }),
        mockUser.id,
      );
      expect(result).toEqual(mockPolicyResponse);
    });

    it('should create policy through validateIssuanceGates and IssuePolicyService via POST /policies', async () => {
      const dto = { quotationId: 'quote-100' };

      const result = await controller.createPolicyRoot(dto, mockUser);
      expect(backOfficeQueueService.validateIssuanceGates).toHaveBeenCalledWith('quote-100');
      expect(issuePolicyService.execute).toHaveBeenCalledWith(
        expect.objectContaining({ quotationId: 'quote-100', issueSource: 'POLICY_CONVERSION' }),
        mockUser.id,
      );
      expect(result).toEqual(mockPolicyResponse);
    });
  });

  describe('Unauthorized', () => {
    it('should throw UnauthorizedException when credentials fail', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(
          new UnauthorizedException('Unauthorized access'),
        );

      await expect(controller.findOne('policy-123', mockUser)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('Forbidden', () => {
    it('should throw ForbiddenException when user cannot perform action', async () => {
      jest
        .spyOn(cancelService, 'execute')
        .mockRejectedValueOnce(new ForbiddenException('Access denied'));

      await expect(
        controller.cancel('policy-123', 'Comments', mockUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Not Found', () => {
    it('should throw NotFoundException when policy is missing', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(new NotFoundException('Policy not found'));

      await expect(
        controller.findOne('policy-nonexistent', mockUser),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
