import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';
import { RoleType } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('UsersController — User 360 Financial Authorization (Phase 5)', () => {
  let controller: UsersController;
  let mockUsersService: any;

  beforeEach(async () => {
    mockUsersService = {
      getEmployeeCommissions: jest.fn(),
      getEmployeeIncentives: jest.fn(),
      findById: jest.fn(),
      findAll: jest.fn(),
      getUserWorkspace: jest.fn(),
      updateStatus: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      lockUser: jest.fn(),
      unlockUser: jest.fn(),
      adminResetPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  const tenantAdmin = {
    id: 'admin-1',
    userId: 'admin-1',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    companyId: 'company-A',
  } as any;

  describe('getEmployeeCommissions', () => {
    it('successfully delegates to usersService with exact userId and actor context', async () => {
      mockUsersService.getEmployeeCommissions.mockResolvedValue([
        {
          id: 'comm-1',
          policyNumber: 'POL-1001',
          userId: 'user-123',
          amount: 2500,
          status: 'PAID',
        },
      ]);

      const res = await controller.getEmployeeCommissions('user-123', tenantAdmin);

      expect(res).toHaveLength(1);
      expect(res[0].userId).toBe('user-123');
      expect(mockUsersService.getEmployeeCommissions).toHaveBeenCalledWith(
        'user-123',
        tenantAdmin,
      );
    });

    it('propagates ForbiddenException when cross-tenant access occurs', async () => {
      mockUsersService.getEmployeeCommissions.mockRejectedValue(
        new ForbiddenException('User belongs to another organization'),
      );

      await expect(
        controller.getEmployeeCommissions('user-foreign', tenantAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFoundException when requested user does not exist', async () => {
      mockUsersService.getEmployeeCommissions.mockRejectedValue(
        new NotFoundException('User with ID user-missing not found'),
      );

      await expect(
        controller.getEmployeeCommissions('user-missing', tenantAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEmployeeIncentives', () => {
    it('successfully delegates to usersService with exact userId and actor context', async () => {
      mockUsersService.getEmployeeIncentives.mockResolvedValue([
        {
          id: 'inc-1',
          userId: 'user-123',
          targetAmount: 500000,
          achievedAmount: 480000,
          status: 'POLICY_PENDING',
        },
      ]);

      const res = await controller.getEmployeeIncentives('user-123', tenantAdmin);

      expect(res).toHaveLength(1);
      expect(res[0].userId).toBe('user-123');
      expect(mockUsersService.getEmployeeIncentives).toHaveBeenCalledWith(
        'user-123',
        tenantAdmin,
      );
    });

    it('propagates ForbiddenException when cross-tenant access occurs', async () => {
      mockUsersService.getEmployeeIncentives.mockRejectedValue(
        new ForbiddenException('User belongs to another organization'),
      );

      await expect(
        controller.getEmployeeIncentives('user-foreign', tenantAdmin),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFoundException when requested user does not exist', async () => {
      mockUsersService.getEmployeeIncentives.mockRejectedValue(
        new NotFoundException('User with ID user-missing not found'),
      );

      await expect(
        controller.getEmployeeIncentives('user-missing', tenantAdmin),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
