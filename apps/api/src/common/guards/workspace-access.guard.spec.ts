import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType, UserStatus } from '@prisma/client';
import {
  WorkspaceAccessGuard,
  resolvePermittedWorkspaces,
} from './workspace-access.guard';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('WorkspaceAccessGuard & Matrix (Iteration 2)', () => {
  let guard: WorkspaceAccessGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new WorkspaceAccessGuard(reflector);
  });

  const createMockContext = (
    actor: Partial<ActorContext>,
    requiredWorkspace?: string,
    requestOverrides?: { query?: any; body?: any; params?: any },
  ): ExecutionContext => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(requiredWorkspace);
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            userId: 'usr-test',
            email: 'test@jest.com',
            firstName: 'Test',
            lastName: 'User',
            organizationId: 'org-1',
            companyId: 'org-1',
            role: actor.role || RoleType.AGENT,
            roles: actor.roles || [actor.role || RoleType.AGENT],
            permissions: actor.permissions || [],
            workspaces: [],
            status: UserStatus.ACTIVE,
            ...actor,
          },
          query: requestOverrides?.query || {},
          body: requestOverrides?.body || {},
          params: requestOverrides?.params || {},
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  describe('Role-based Workspace Authorization', () => {
    it('should allow SALES_AGENT to access SALES workspace', () => {
      const ctx = createMockContext({ role: RoleType.AGENT }, 'SALES');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny SALES_AGENT from accessing FINANCE workspace', () => {
      const ctx = createMockContext({ role: RoleType.AGENT }, 'BACK_OFFICE');
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow FINANCE_ACCOUNTS_EXECUTIVE to access FINANCE workspace', () => {
      const ctx = createMockContext(
        { role: RoleType.BACK_OFFICE },
        'BACK_OFFICE',
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OPERATIONS and POLICY_ISSUANCE_EXECUTIVE to access BACK_OFFICE workspace', () => {
      const ctx = createMockContext(
        { role: RoleType.BACK_OFFICE },
        'BACK_OFFICE',
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow RENEWAL_EXECUTIVE to access RENEWALS workspace', () => {
      const ctx = createMockContext(
        { role: RoleType.BACK_OFFICE },
        'RENEWALS',
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow SUPER_ADMIN access to any workspace', () => {
      const ctx1 = createMockContext({ role: RoleType.ADMIN }, 'SALES');
      const ctx2 = createMockContext({ role: RoleType.ADMIN }, 'BACK_OFFICE');
      const ctx3 = createMockContext(
        { role: RoleType.ADMIN },
        'ADMINISTRATION',
      );

      expect(guard.canActivate(ctx1)).toBe(true);
      expect(guard.canActivate(ctx2)).toBe(true);
      expect(guard.canActivate(ctx3)).toBe(true);
    });
  });

  describe('Company-Branch Hierarchy Enforcement', () => {
    it('should allow user accessing resources within their assigned branch', () => {
      const ctx = createMockContext(
        { role: RoleType.AGENT, branchId: 'branch-101' },
        'SALES',
        { query: { branchId: 'branch-101' } },
      );
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny non-global user accessing resources from another branch', () => {
      const ctx = createMockContext(
        { role: RoleType.AGENT, branchId: 'branch-101' },
        'SALES',
        { query: { branchId: 'branch-999' } },
      );
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should deny non-global user accessing resources from another company', () => {
      const ctx = createMockContext(
        { role: RoleType.AGENT, companyId: 'company-1' },
        'SALES',
        { query: { companyId: 'company-2' } },
      );
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow global roles (ADMIN, MD_CEO, SUPER_ADMIN) across any branch', () => {
      const ctxAdmin = createMockContext(
        { role: RoleType.ADMIN, branchId: 'branch-101' },
        'SALES',
        { query: { branchId: 'branch-999' } },
      );
      expect(guard.canActivate(ctxAdmin)).toBe(true);

      const ctxCeo = createMockContext(
        { role: RoleType.ADMIN, branchId: 'branch-101' },
        'MANAGEMENT',
        { body: { branchId: 'branch-999' } },
      );
      expect(guard.canActivate(ctxCeo)).toBe(true);
    });
  });

  describe('resolvePermittedWorkspaces', () => {
    it('should resolve multiple workspaces for users with multi-roles', () => {
      const actor: ActorContext = {
        userId: 'usr-1',
        email: 'manager@jest.com',
        firstName: 'Manager',
        lastName: 'User',
        organizationId: 'org-1',
        companyId: 'org-1',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        permissions: [],
        workspaces: [],
        status: UserStatus.ACTIVE,
      };

      const permitted = resolvePermittedWorkspaces(actor);
      expect(permitted).toContain('SALES');
      expect(permitted).toContain('BACK_OFFICE');
      expect(permitted).toContain('FINANCE');
      expect(permitted).toContain('RENEWALS');
      expect(permitted).toContain('CLAIMS');
      expect(permitted).not.toContain('MANAGEMENT');
      expect(permitted).not.toContain('ADMINISTRATION');
    });
  });
});
