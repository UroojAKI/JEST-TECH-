import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let userRepository: any;

  const mockUser = {
    id: 'user-uuid-1',
    employeeCode: 'EMP-000001',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane.doe@example.com',
    phone: '9876543210',
    designation: 'Senior Agent',
    legacyDepartment: 'Sales',
    status: UserStatus.ACTIVE,
    companyId: 'company-uuid-1',
    collectContacts: true,
    lastLoginAt: new Date('2026-10-30T10:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-10-30T10:00:00Z'),
    role: {
      id: 'role-1',
      name: 'Agent',
      code: 'AGENT',
      type: RoleType.AGENT,
      description: 'Insurance Agent',
      permissions: [
        {
          scope: 'ORGANIZATION',
          permission: {
            id: 'perm-1',
            code: 'POLICY_READ',
            name: 'Read Policies',
            category: 'POLICIES',
          },
        },
      ],
    },
    branch: {
      id: 'branch-1',
      code: 'BR-MUM',
      name: 'Mumbai Central',
      city: 'Mumbai',
    },
    team: {
      id: 'team-1',
      name: 'Direct Sales',
    },
    department: null,
    agentProfile: {
      id: 'agent-1',
      agentCode: 'AG-0001',
      agencyName: 'Direct Agency',
      licenseNumber: 'LIC-001',
      commissionTier: 'TIER_1',
      isActive: true,
    },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
      lead: {
        count: jest.fn().mockResolvedValue(5),
      },
      contact: {
        count: jest.fn().mockResolvedValue(10),
      },
      customer: {
        count: jest.fn().mockResolvedValue(8),
      },
      policy: {
        count: jest.fn().mockResolvedValue(12),
      },
      task: {
        count: jest.fn().mockResolvedValue(3),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: 'Follow up with lead',
            status: 'PENDING',
            priority: 'HIGH',
            dueDate: new Date(),
            createdAt: new Date(),
          },
        ]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-1',
            action: 'LOGIN',
            entity: 'User',
            entityId: 'user-uuid-1',
            ipAddress: '127.0.0.1',
            createdAt: new Date(),
            newValue: { status: 'SUCCESS' },
          },
        ]),
      },
    };

    userRepository = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UserRepository, useValue: userRepository },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  describe('getUserWorkspace', () => {
    it('should throw NotFoundException if user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getUserWorkspace('non-existent-id', { companyId: 'company-uuid-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if tenant companyId does not match actor', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.getUserWorkspace('user-uuid-1', { companyId: 'different-company' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return aggregated workspace data for valid user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const workspace = await service.getUserWorkspace('user-uuid-1', {
        companyId: 'company-uuid-1',
      });

      expect(workspace).toBeDefined();
      expect(workspace.profile.id).toBe('user-uuid-1');
      expect(workspace.profile.name).toBe('Jane Doe');
      expect(workspace.profile.employeeCode).toBe('EMP-000001');
      expect(workspace.profile.collectContacts).toBe(true);
      expect(workspace.profile.role?.name).toBe('Agent');
      expect(workspace.profile.branch?.name).toBe('Mumbai Central');
      expect(workspace.portfolio.leadsCreated).toBe(5);
      expect(workspace.portfolio.customersManaged).toBe(8);
      expect(workspace.portfolio.policiesIssued).toBe(12);
      expect(workspace.portfolio.pendingTasks).toBe(3);
      expect(workspace.recentActivities).toHaveLength(1);
      expect(workspace.recentTasks).toHaveLength(1);
    });
  });
  describe('getEmployeeCommissions & getEmployeeIncentives', () => {
    beforeEach(() => {
      prisma.commission = {
        findMany: jest.fn(),
      };
      prisma.salesTarget = {
        findMany: jest.fn(),
      };
      prisma.policy = {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([]),
      };
      prisma.auditLog = {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      };
    });

    it('throws NotFoundException when requested user does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.getEmployeeCommissions('missing-user-id', { companyId: 'org-1' }),
      ).rejects.toThrow(NotFoundException);

      await expect(
        service.getEmployeeIncentives('missing-user-id', { companyId: 'org-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects cross-tenant access with ForbiddenException', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-foreign',
        companyId: 'org-foreign',
        firstName: 'Foreign',
        lastName: 'Agent',
      });

      const tenantAdminActor = {
        userId: 'admin-1',
        companyId: 'org-my-company',
      };

      await expect(
        service.getEmployeeCommissions('user-foreign', tenantAdminActor),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.getEmployeeIncentives('user-foreign', tenantAdminActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('queries exact employee database ID avoiding name collision and returns records with audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        companyId: 'org-my-company',
        firstName: 'Amit',
        lastName: 'Sharma',
      });

      prisma.commission.findMany.mockResolvedValue([
        {
          id: 'comm-1',
          policyId: 'pol-1',
          userId: 'user-123',
          amount: '1500.00',
          roleTier: 'AGENT',
          status: 'PAID',
          createdAt: new Date(),
        },
      ]);

      prisma.policy.findMany.mockResolvedValue([
        {
          id: 'pol-1',
          policyNumber: 'POL-1001',
          premiumAmount: '10000',
          contact: { firstName: 'Rahul', lastName: 'Verma' },
        },
      ]);

      const tenantAdminActor = {
        userId: 'admin-1',
        companyId: 'org-my-company',
      };

      const result = await service.getEmployeeCommissions('user-123', tenantAdminActor);

      expect(result).toHaveLength(1);
      expect(result[0].policyNumber).toBe('POL-1001');
      expect(result[0].customerName).toBe('Rahul Verma');
      expect(result[0].userId).toBe('user-123');
      expect(result[0].amount).toBe(1500);

      // Verify exact ID filter in query
      expect(prisma.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        }),
      );

      // Verify audit log creation
      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity: 'Commission',
            entityType: 'COMMISSION_ACCESS',
            entityId: 'user-123',
            module: 'FINANCE_AUDIT',
          }),
        }),
      );
    });

    it('queries exact employee database ID for incentives and returns records with audit log', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        companyId: 'org-my-company',
        firstName: 'Amit',
        lastName: 'Sharma',
      });

      prisma.salesTarget.findMany.mockResolvedValue([
        {
          id: 'target-1',
          userId: 'user-123',
          year: 2026,
          month: 10,
          targetGwp: '500000',
          achievedGwp: '450000',
        },
      ]);

      const tenantAdminActor = {
        userId: 'admin-1',
        companyId: 'org-my-company',
      };

      const result = await service.getEmployeeIncentives('user-123', tenantAdminActor);

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-123');
      expect(result[0].targetAmount).toBe(500000);
      expect(result[0].achievedAmount).toBe(450000);
      expect(result[0].status).toBe('POLICY_PENDING');

      expect(prisma.salesTarget.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
          }),
        }),
      );

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entity: 'SalesTarget',
            entityType: 'INCENTIVE_ACCESS',
            entityId: 'user-123',
            module: 'FINANCE_AUDIT',
          }),
        }),
      );
    });
  });
});
