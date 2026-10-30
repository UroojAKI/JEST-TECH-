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

  describe('updateRolePermissions', () => {
    const superAdminActor: any = {
      id: 'super-admin-1',
      role: RoleType.ADMIN,
      permissions: ['*'],
      companyId: 'company-1',
    };

    const regularAdminActor: any = {
      id: 'admin-1',
      role: RoleType.ADMIN,
      permissions: ['lead:read'],
      companyId: 'company-1',
    };

    it('rejects non-super-admin caller with ForbiddenException', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-1',
        name: 'Agent',
        type: RoleType.AGENT,
      });

      await expect(
        controller.updateRolePermissions(
          'role-1',
          { permissions: [{ code: 'lead:read' }] },
          regularAdminActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects unknown permission code with BadRequestException', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-1',
        name: 'Agent',
        type: RoleType.AGENT,
      });
      mockPrisma.permission.findFirst.mockResolvedValue(null);

      await expect(
        controller.updateRolePermissions(
          'role-1',
          { permissions: [{ code: 'malicious:unauthorized:perm' }] },
          superAdminActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully updates role with canonical permission and creates audit log transactionally', async () => {
      mockPrisma.role.findFirst.mockResolvedValue({
        id: 'role-1',
        name: 'Agent',
        type: RoleType.AGENT,
      });
      mockPrisma.permission.findFirst.mockResolvedValue({
        id: 'perm-lead-read',
        code: 'lead:read',
        name: 'Read Leads',
      });

      const res = await controller.updateRolePermissions(
        'role-1',
        { permissions: [{ code: 'lead:read', scope: AccessScope.ORGANIZATION }] },
        superAdminActor,
      );

      expect(res.success).toBe(true);
      expect(mockPrisma.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role-1' },
      });
      expect(mockPrisma.rolePermission.createMany).toHaveBeenCalledWith({
        data: [
          {
            roleId: 'role-1',
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
            entityId: 'role-1',
            module: 'ADMIN_RBAC',
          }),
        }),
      );
    });
  });
});
