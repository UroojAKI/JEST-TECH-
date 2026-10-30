import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
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
});
