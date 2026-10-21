import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { AuditController } from './audit.controller';
import { AuditService } from '../services/audit.service';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';

describe('AuditController (Phase 1 / DEF-024 Tenant Isolation)', () => {
  let controller: AuditController;
  let mockAuditService: any;

  beforeEach(async () => {
    mockAuditService = {
      getAuditLogs: jest.fn().mockResolvedValue({ data: [], meta: {} }),
      exportAuditLogs: jest.fn().mockResolvedValue('ID,Timestamp'),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    }).compile();

    controller = module.get<AuditController>(AuditController);
  });

  describe('resolveAuditAccess & getAuditLogs', () => {
    it('scopes ordinary tenant admin strictly to their companyId', async () => {
      const user: RequestUser = {
        id: 'u-admin-1',
        userId: 'u-admin-1',
        email: 'admin@tenant-a.com',
        firstName: 'Tenant',
        lastName: 'Admin',
        organizationId: 'tenant-a-org',
        companyId: 'tenant-a-company',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['AUDIT_READ'],
        workspaces: ['Admin'],
        status: 'ACTIVE' as any,
      };

      await controller.getAuditLogs(user, 'Policy', 'CREATE');

      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
        { scope: 'TENANT', companyId: 'tenant-a-company' },
        expect.objectContaining({ entity: 'Policy', action: 'CREATE' }),
      );
    });

    it('rejects ordinary admin when tenant companyId is missing or empty', async () => {
      const userWithoutTenant: RequestUser = {
        id: 'u-admin-2',
        userId: 'u-admin-2',
        email: 'broken@jest.com',
        firstName: 'Broken',
        lastName: 'Admin',
        organizationId: '',
        companyId: '',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['AUDIT_READ'],
        workspaces: ['Admin'],
        status: 'ACTIVE' as any,
      };

      await expect(controller.getAuditLogs(userWithoutTenant)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockAuditService.getAuditLogs).not.toHaveBeenCalled();
    });

    it('prevents privilege escalation when ordinary admin has wildcard permission but has companyId', async () => {
      const userWithWildcardInTenant: RequestUser = {
        id: 'u-admin-3',
        userId: 'u-admin-3',
        email: 'wildcard@tenant-a.com',
        firstName: 'Wildcard',
        lastName: 'Admin',
        organizationId: 'tenant-a-org',
        companyId: 'tenant-a-company',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['*'], // Wildcard inside tenant
        workspaces: ['Admin'],
        status: 'ACTIVE' as any,
      };

      await controller.getAuditLogs(userWithWildcardInTenant);

      // Must remain scoped to tenant-a-company! No escalation to GLOBAL!
      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
        { scope: 'TENANT', companyId: 'tenant-a-company' },
        expect.anything(),
      );
    });

    it('allows global access only for authorized platform super-admin without tenant affiliation', async () => {
      const platformSuperAdmin: RequestUser = {
        id: 'u-super-1',
        userId: 'u-super-1',
        email: 'root@platform.dev',
        firstName: 'Platform',
        lastName: 'SuperAdmin',
        organizationId: '',
        companyId: '',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['*'],
        workspaces: ['Admin'],
        status: 'ACTIVE' as any,
      };

      await controller.getAuditLogs(platformSuperAdmin);

      expect(mockAuditService.getAuditLogs).toHaveBeenCalledWith(
        { scope: 'GLOBAL', actorId: 'u-super-1' },
        expect.anything(),
      );
    });

    it('enforces identical scoping policy on audit export', async () => {
      const tenantUser: RequestUser = {
        id: 'u-admin-1',
        userId: 'u-admin-1',
        email: 'admin@tenant-a.com',
        firstName: 'Tenant',
        lastName: 'Admin',
        organizationId: 'tenant-a-org',
        companyId: 'tenant-a-company',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['AUDIT_READ'],
        workspaces: ['Admin'],
        status: 'ACTIVE' as any,
      };

      await controller.exportAuditLogs(tenantUser, 'csv', 'Policy');

      expect(mockAuditService.exportAuditLogs).toHaveBeenCalledWith(
        { scope: 'TENANT', companyId: 'tenant-a-company' },
        expect.objectContaining({ format: 'csv', entity: 'Policy' }),
      );
    });
  });
});
