import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RolesController } from './roles.controller';
import { PrismaService } from '../../../../database/prisma.service';
import { AccessScope, RoleType } from '@prisma/client';

describe('RolesController', () => {
  let controller: RolesController;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      permission: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      rolePermission: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      $transaction: jest.fn(async (callback) => callback(mockPrisma)),
    };

    controller = new RolesController(mockPrisma as unknown as PrismaService);
  });

  const superAdminActor: any = {
    id: 'super-admin-1',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    isPlatformAdmin: true,
    permissions: ['*'],
    companyId: 'company-platform',
  };

  const tenantAdminActor: any = {
    id: 'tenant-admin-1',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    isPlatformAdmin: false,
    permissions: ['lead:read'],
    companyId: 'company-1',
  };

  const backOfficeActor: any = {
    id: 'bo-1',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    companyId: 'company-1',
  };

  const agentActor: any = {
    id: 'agent-1',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    companyId: 'company-1',
  };

  describe('getRoles and getRolePermissions', () => {
    it('blocks Agent from viewing role list', async () => {
      await expect(controller.getRoles(agentActor)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('blocks Agent from viewing role permissions', async () => {
      await expect(
        controller.getRolePermissions('role-1', agentActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Tenant Admin to view roles', async () => {
      mockPrisma.role.findMany.mockResolvedValue([
        {
          id: 'role-1',
          name: 'Admin',
          type: RoleType.ADMIN,
          permissions: [],
        },
      ]);

      const res = await controller.getRoles(tenantAdminActor);
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe('role-1');
    });

    it('throws NotFoundException if role does not exist when fetching role permissions', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);
      await expect(
        controller.getRolePermissions('non-existent', tenantAdminActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRolePermissions — RBAC & Platform Privilege Enforcement', () => {
    beforeEach(() => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-agent',
        name: 'Agent',
        type: RoleType.AGENT,
        code: 'AGENT',
      });
    });

    it('rejects regular Tenant Admin caller with ForbiddenException', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'lead:read' }] },
          tenantAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects Back Office caller with ForbiddenException', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'lead:read' }] },
          backOfficeActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects Agent caller with ForbiddenException', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'lead:read' }] },
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects non-super-admin attempting to spoof isSuperAdmin in actor context', async () => {
      const spoofedActor: any = {
        id: 'spoofed-1',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        isPlatformAdmin: false,
        isSuperAdmin: true, // Spoofed property
        companyId: 'company-1',
      };

      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'lead:read' }] },
          spoofedActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects self-granting wildcard platform privileges (*)', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: '*' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects self-granting PLATFORM_SUPER_ADMIN privileges', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'PLATFORM_SUPER_ADMIN' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects duplicate permissions in input array', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          {
            permissions: [
              { code: 'lead:read' },
              { code: 'lead:read' },
            ],
          },
          superAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects invalid scope value in permission item', async () => {
      await expect(
        controller.updateRolePermissions(
          'role-agent',
          {
            permissions: [
              { code: 'lead:read', scope: 'INVALID_SCOPE' as any },
            ],
          },
          superAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown permission code not in DB and not in canonical catalog', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'malicious:unauthorized:perm' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects unknown permission ID not found in database', async () => {
      mockPrisma.permission.findUnique.mockResolvedValue(null);

      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ permissionId: 'non-existent-perm-id' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if target role does not exist', async () => {
      mockPrisma.role.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateRolePermissions(
          'non-existent-role',
          { permissions: [{ code: 'lead:read' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('rolls back transaction if audit log creation fails', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue({
        id: 'perm-lead-read',
        code: 'lead:read',
        name: 'Read Leads',
      });
      mockPrisma.auditLog.create.mockRejectedValue(
        new Error('Audit log database error'),
      );

      await expect(
        controller.updateRolePermissions(
          'role-agent',
          { permissions: [{ code: 'lead:read' }] },
          superAdminActor,
        ),
      ).rejects.toThrow('Audit log database error');
    });

    it('successfully updates role with canonical permission and creates audit log in same transaction', async () => {
      mockPrisma.permission.findFirst.mockResolvedValue({
        id: 'perm-lead-read',
        code: 'lead:read',
        name: 'Read Leads',
      });

      const res = await controller.updateRolePermissions(
        'role-agent',
        { permissions: [{ code: 'lead:read', scope: AccessScope.ORGANIZATION }] },
        superAdminActor,
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role-agent' },
      });
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          {
            roleId: 'role-agent',
            permissionId: 'perm-lead-read',
            scope: AccessScope.ORGANIZATION,
          },
        ],
        skipDuplicates: true,
      });
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE',
            entityType: 'ROLE_PERMISSION',
            entityId: 'role-agent',
            module: 'ADMIN_RBAC',
          }),
        }),
      );
    });
  });
});
