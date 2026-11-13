import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '../repositories/user.repository';
import { PrismaService } from '../../../database/prisma.service';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ValidationPipe,
} from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { CreateUserDto } from '../dto/create-user.dto';
import { InviteUserDto } from '../dto/invite-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

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
        update: jest.fn().mockResolvedValue({ id: 'user-uuid-1', authVersion: 2 }),
      },
      workspacePreference: {
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(async (operation: any) => operation({ agent: { create: jest.fn() } })),
      company: {
        findFirst: jest.fn().mockResolvedValue({ id: 'company-uuid-1' }),
      },
      role: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      branch: {
        findFirst: jest.fn(),
      },
      department: {
        findFirst: jest.fn(),
      },
      agent: {
        create: jest.fn(),
      },
      lead: {
        count: jest.fn().mockResolvedValue(5),
      },
      contact: {
        count: jest.fn().mockResolvedValue(10),
      },
      customer: {
        count: jest.fn().mockResolvedValue(8),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cust-1',
            customerCode: 'CUST-001',
            name: 'Acme Corp',
            phone: '9876543210',
            email: 'info@acme.com',
            policies: [{ id: 'pol-1', premiumAmount: 50000, actualPremium: 50000 }],
            createdAt: new Date(),
          },
        ]),
      },
      claim: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'claim-1',
            claimNumber: 'CLM-001',
            claimAmount: 15000,
            settledAmount: 12000,
            status: 'APPROVED',
            policy: { policyNumber: 'POL-001' },
            contact: { firstName: 'Alice', lastName: 'Smith', phone: '9876543211' },
            createdAt: new Date(),
          },
        ]),
      },
      policy: {
        count: jest.fn().mockResolvedValue(12),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pol-1',
            policyNumber: 'POL-001',
            actualPolicyNumber: 'POL-001',
            premiumAmount: 50000,
            actualPremium: 50000,
            status: 'ACTIVE',
            effectiveDate: new Date(),
            expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
            createdAt: new Date(),
            contact: { firstName: 'Alice', lastName: 'Smith', phone: '9876543211' },
            quotation: { insurerName: 'HDFC ERGO', productType: 'MOTOR' },
          },
        ]),
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
      findById: jest.fn().mockResolvedValue(mockUser),
      findRoleByType: jest.fn().mockResolvedValue({ id: 'role-agent' }),
      create: jest.fn().mockResolvedValue(mockUser),
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

  describe('create tenant hierarchy validation', () => {
    it('rolls back Agent user creation when Agent profile provisioning fails', async () => {
      prisma.branch.findFirst.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
      const profileError = new Error('Agent profile insert failed');
      const tx = { agent: { create: jest.fn().mockRejectedValue(profileError) } };
      prisma.$transaction.mockImplementation(async (operation: any) => operation(tx));

      await expect(
        service.create(
          {
            firstName: 'New',
            lastName: 'Agent',
            email: 'new.agent@example.com',
            password: 'SafePassword123!',
            role: 'AGENT',
            employeeCode: 'EMP-009998',
            branchId: '11111111-1111-4111-8111-111111111111',
          } as any,
          { userId: 'admin-1', companyId: 'company-uuid-1', role: 'ADMIN' },
        ),
      ).rejects.toThrow('Agent profile insert failed');

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(userRepository.create).toHaveBeenCalled();
      expect(tx.agent.create).toHaveBeenCalled();
    });

    it('rejects a branch that does not belong to the actor company before creating a user', async () => {
      prisma.branch.findFirst.mockResolvedValue(null);

      await expect(
        service.create(
          {
            firstName: 'New',
            lastName: 'Agent',
            email: 'new.agent@example.com',
            password: 'SafePassword123!',
            role: 'AGENT',
            employeeCode: 'EMP-009999',
            branchId: '11111111-1111-4111-8111-111111111111',
          } as any,
          { userId: 'admin-1', companyId: 'company-uuid-1', role: 'ADMIN' },
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.branch.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            zone: { region: { company: { id: 'company-uuid-1' } } },
          }),
        }),
      );
      expect(userRepository.create).not.toHaveBeenCalled();
    });
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
      expect(workspace.portfolio.customersManaged).toBe(10);
      expect(workspace.portfolio.policiesIssued).toBe(12);
      expect(workspace.portfolio.pendingTasks).toBe(3);
      expect(workspace.recentActivities).toHaveLength(3); // 1 audit + 1 policy + 1 claim operational events
      expect(workspace.recentTasks).toHaveLength(1);
      expect(workspace.recentCustomers).toHaveLength(1);
      expect(workspace.recentCustomers[0].name).toBe('Acme Corp');
      expect(workspace.recentCustomers[0].totalGwp).toBe(50000);
      expect(workspace.recentClaims).toHaveLength(1);
      expect(workspace.recentClaims[0].claimNumber).toBe('CLM-001');
      expect(workspace.recentRenewals).toHaveLength(1);
      expect(workspace.recentRenewals[0].daysToExpiry).toBeGreaterThan(0);
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

  describe('Individual User Permission Overrides & Effective Resolution', () => {
    const actor = {
      userId: 'admin-1',
      companyId: 'company-uuid-1',
      role: 'ADMIN',
    };

    it('should return role baseline permissions when no overrides exist', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockUser,
        role: {
          id: 'role-1',
          name: 'Agent',
          code: 'AGENT',
          type: RoleType.AGENT,
          permissions: [
            { permission: { code: 'policy:read' } },
            { permission: { code: 'quotation:create' } },
          ],
        },
      });
      prisma.workspacePreference.findUnique.mockResolvedValue(null);

      const result = await service.getUserPermissions('user-uuid-1', actor);

      expect(result.userId).toBe('user-uuid-1');
      expect(result.basePermissions).toEqual(['policy:read', 'quotation:create']);
      expect(result.overrides.granted).toEqual([]);
      expect(result.overrides.revoked).toEqual([]);
      expect(result.effectivePermissions).toEqual(['policy:read', 'quotation:create']);
    });

    it('should correctly apply granted and revoked overrides to calculate effective permissions', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockUser,
        role: {
          id: 'role-1',
          name: 'Agent',
          code: 'AGENT',
          type: RoleType.AGENT,
          permissions: [
            { permission: { code: 'policy:read' } },
            { permission: { code: 'quotation:create' } },
            { permission: { code: 'lead:delete' } },
          ],
        },
      });
      prisma.workspacePreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-uuid-1',
        favoriteWidgets: {
          permissionOverrides: {
            granted: ['policy:issue', 'customer:export'],
            revoked: ['lead:delete'],
            scopes: { 'policy:issue': 'OWN' },
          },
        },
      });

      const result = await service.getUserPermissions('user-uuid-1', actor);

      expect(result.basePermissions).toEqual(['policy:read', 'quotation:create', 'lead:delete']);
      expect(result.overrides.granted).toContain('policy:issue');
      expect(result.overrides.revoked).toContain('lead:delete');
      expect(result.effectivePermissions).toContain('policy:read');
      expect(result.effectivePermissions).toContain('quotation:create');
      expect(result.effectivePermissions).toContain('policy:issue');
      expect(result.effectivePermissions).toContain('customer:export');
      expect(result.effectivePermissions).not.toContain('lead:delete');
    });

    it('should persist permission overrides and increment authVersion upon update', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      prisma.workspacePreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-uuid-1',
        favoriteWidgets: {},
      });

      await service.updateUserPermissions(
        'user-uuid-1',
        {
          granted: ['policy:issue'],
          revoked: ['lead:read'],
          scopes: { 'policy:issue': 'OWN' },
        },
        actor,
      );

      expect(prisma.workspacePreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref-1' },
          data: expect.objectContaining({
            favoriteWidgets: expect.objectContaining({
              permissionOverrides: expect.objectContaining({
                granted: ['policy:issue'],
                revoked: ['lead:read'],
                scopes: { 'policy:issue': 'OWN' },
              }),
            }),
          }),
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { authVersion: { increment: 1 } },
      });
    });

    it('should reset user permissions to role baseline and increment authVersion', async () => {
      userRepository.findById.mockResolvedValue(mockUser);
      prisma.workspacePreference.findUnique.mockResolvedValue({
        id: 'pref-1',
        userId: 'user-uuid-1',
        favoriteWidgets: {
          permissionOverrides: { granted: ['policy:issue'] },
          otherSetting: true,
        },
      });

      await service.resetUserPermissions('user-uuid-1', actor);

      expect(prisma.workspacePreference.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pref-1' },
          data: {
            favoriteWidgets: { otherSetting: true },
          },
        }),
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { authVersion: { increment: 1 } },
      });
    });

    it('should reject cross-organization permission inspection with ForbiddenException', async () => {
      userRepository.findById.mockResolvedValue({
        ...mockUser,
        companyId: 'other-company',
      });

      await expect(
        service.getUserPermissions('user-uuid-1', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('user mobile number validation, search, and updates', () => {
    const validationPipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    });

    it('accepts optional 10-digit numbers (including 1234567890) on CreateUserDto and InviteUserDto', async () => {
      const created = await validationPipe.transform(
        {
          firstName: 'Test',
          lastName: 'Agent',
          email: 'test@example.com',
          role: 'AGENT',
          phone: ' 1234567890 ',
        },
        { type: 'body', metatype: CreateUserDto },
      );
      expect(created.phone).toBe('1234567890');

      const invitedBlank = await validationPipe.transform(
        {
          firstName: 'Test',
          lastName: 'Agent',
          email: 'invite@example.com',
          role: 'AGENT',
          phone: '   ',
        },
        { type: 'body', metatype: InviteUserDto },
      );
      expect(invitedBlank.phone).toBeUndefined();
    });

    it('rejects non-10-digit phone numbers on CreateUserDto, InviteUserDto, and UpdateUserDto', async () => {
      await expect(
        validationPipe.transform(
          {
            firstName: 'Test',
            lastName: 'Agent',
            email: 'test@example.com',
            role: 'AGENT',
            phone: '12345',
          },
          { type: 'body', metatype: CreateUserDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        validationPipe.transform(
          {
            firstName: 'Test',
            lastName: 'Agent',
            email: 'invite@example.com',
            role: 'AGENT',
            phone: '987654321a',
          },
          { type: 'body', metatype: InviteUserDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const cleared = await validationPipe.transform(
        { phone: '' },
        { type: 'body', metatype: UpdateUserDto },
      );
      expect(cleared.phone).toBeNull();
    });

    it('persists 10-digit phone on create and rejects invalid phone in service calls', async () => {
      await expect(
        service.create(
          {
            firstName: 'New',
            lastName: 'Agent',
            email: 'new@example.com',
            role: 'AGENT',
            phone: '999',
          } as any,
          { companyId: 'company-uuid-1' },
        ),
      ).rejects.toThrow(BadRequestException);

      await service.create(
        {
          firstName: 'New',
          lastName: 'Agent',
          email: 'new@example.com',
          role: 'BACK_OFFICE',
          employeeCode: 'EMP-009997',
          phone: '1234567890',
        } as any,
        { companyId: 'company-uuid-1' },
      );

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '1234567890' }),
        expect.anything(),
      );
    });

    it('updates and clears user phone cleanly via update()', async () => {
      userRepository.update = jest.fn().mockResolvedValue({ ...mockUser, phone: '9876500000' });

      await service.update(
        'user-uuid-1',
        { phone: '9876500000' },
        { companyId: 'company-uuid-1' },
      );
      expect(userRepository.update).toHaveBeenCalledWith('user-uuid-1', {
        phone: '9876500000',
      });

      await service.update(
        'user-uuid-1',
        { phone: '' } as any,
        { companyId: 'company-uuid-1' },
      );
      expect(userRepository.update).toHaveBeenLastCalledWith('user-uuid-1', {
        phone: null,
      });
    });

    it('includes phone in findAll search filter', async () => {
      prisma.user.findMany = jest.fn().mockResolvedValue([mockUser]);
      prisma.user.count = jest.fn().mockResolvedValue(1);

      await service.findAll(
        { page: 1, limit: 25, search: '98765' } as any,
        undefined,
        { companyId: 'company-uuid-1' },
      );

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { phone: { contains: '98765', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });
  });
});
