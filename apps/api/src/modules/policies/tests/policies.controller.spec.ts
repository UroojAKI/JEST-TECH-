import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PolicyStatus, RoleType } from '@prisma/client';

import { PoliciesController } from '../controllers/policies.controller';
import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { CancelPolicyService } from '../services/commands/cancel-policy.service';
import { RenewPolicyService } from '../services/commands/renew-policy.service';
import { GetPolicyService } from '../services/queries/get-policy.service';
import { GetPolicyHistoryService } from '../services/queries/get-policy-history.service';
import { CreatePolicyDto } from '../dto/create-policy.dto';
import { RenewPolicyDto } from '../dto/renew-policy.dto';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('PoliciesController', () => {
  let controller: PoliciesController;
  let issueService: IssuePolicyService;
  let cancelService: CancelPolicyService;
  let renewService: RenewPolicyService;
  let getService: GetPolicyService;
  let historyService: GetPolicyHistoryService;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'underwriter@jestpolicy.com',
    role: RoleType.UNDERWRITER,
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
          provide: IssuePolicyService,
          useValue: {
            execute: jest.fn().mockResolvedValue(mockPolicyResponse),
          },
        },
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
      ],
    }).compile();

    controller = module.get<PoliciesController>(PoliciesController);
    issueService = module.get<IssuePolicyService>(IssuePolicyService);
    cancelService = module.get<CancelPolicyService>(CancelPolicyService);
    renewService = module.get<RenewPolicyService>(RenewPolicyService);
    getService = module.get<GetPolicyService>(GetPolicyService);
    historyService = module.get<GetPolicyHistoryService>(
      GetPolicyHistoryService,
    );
  });

  // 1. Happy Path
  describe('Happy Path', () => {
    it('should issue a policy', async () => {
      const dto = new CreatePolicyDto();
      dto.quotationId = 'quote-123';
      dto.nominees = [
        {
          firstName: 'Nominee',
          lastName: 'User',
          relation: 'Spouse',
          percentage: 100,
        },
      ];
      dto.payment = {
        amount: 11800,
        transactionId: 'TXN-123',
        paymentMethod: 'UPI',
      };

      const result = await controller.create(dto, mockUser);
      expect(result).toEqual(mockPolicyResponse);
      expect(issueService.execute).toHaveBeenCalledWith(dto, mockUser.id);
    });

    it('should find one policy', async () => {
      const result = await controller.findOne('policy-123');
      expect(result).toEqual(mockPolicyResponse);
      expect(getService.executeOne).toHaveBeenCalledWith(
        'policy-123',
        undefined,
      );
    });

    it('should cancel a policy', async () => {
      const result = await controller.cancel(
        'policy-123',
        'Customer request',
        mockUser,
      );
      expect(result.status).toEqual(PolicyStatus.CANCELLED);
      expect(cancelService.execute).toHaveBeenCalledWith(
        'policy-123',
        'Customer request',
        mockUser.id,
      );
    });
  });

  // 2. Validation Failure
  describe('Validation Failure', () => {
    it('should throw BadRequestException for incorrect allocations', async () => {
      jest
        .spyOn(issueService, 'execute')
        .mockRejectedValueOnce(new BadRequestException('Validation failed'));
      const invalidDto = new CreatePolicyDto();

      await expect(controller.create(invalidDto, mockUser)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // 3. Unauthorized
  describe('Unauthorized', () => {
    it('should throw UnauthorizedException when credentials fail', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(
          new UnauthorizedException('Unauthorized access'),
        );

      await expect(controller.findOne('policy-123')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // 4. Forbidden
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

  // 5. Not Found
  describe('Not Found', () => {
    it('should throw NotFoundException when policy is missing', async () => {
      jest
        .spyOn(getService, 'executeOne')
        .mockRejectedValueOnce(new NotFoundException('Policy not found'));

      await expect(controller.findOne('policy-nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // 6. Conflict
  describe('Conflict', () => {
    it('should throw ConflictException when policy has duplicate quotation link', async () => {
      jest
        .spyOn(issueService, 'execute')
        .mockRejectedValueOnce(new ConflictException('Policy already issued'));
      const dto = new CreatePolicyDto();

      await expect(controller.create(dto, mockUser)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
