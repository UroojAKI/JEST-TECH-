import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType, UserStatus } from '@prisma/client';
import { WorkspaceAccessGuard, resolvePermittedWorkspaces } from './workspace-access.guard';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('WorkspaceAccessGuard & Matrix (Iteration 2)', () => {
  let guard: WorkspaceAccessGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new WorkspaceAccessGuard(reflector);
  });

  const createMockContext = (actor: Partial<ActorContext>, requiredWorkspace?: string): ExecutionContext => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredWorkspace);
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
            role: actor.role || RoleType.SALES_AGENT,
            roles: actor.roles || [actor.role || RoleType.SALES_AGENT],
            permissions: actor.permissions || [],
            workspaces: [],
            status: UserStatus.ACTIVE,
            ...actor,
          },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  describe('Role-based Workspace Authorization', () => {
    it('should allow SALES_AGENT to access SALES workspace', () => {
      const ctx = createMockContext({ role: RoleType.SALES_AGENT }, 'SALES');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should deny SALES_AGENT from accessing FINANCE workspace', () => {
      const ctx = createMockContext({ role: RoleType.SALES_AGENT }, 'FINANCE');
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    it('should allow FINANCE_ACCOUNTS_EXECUTIVE to access FINANCE workspace', () => {
      const ctx = createMockContext({ role: RoleType.FINANCE_ACCOUNTS_EXECUTIVE }, 'FINANCE');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow OPERATIONS and POLICY_ISSUANCE_EXECUTIVE to access BACK_OFFICE workspace', () => {
      const ctx = createMockContext({ role: RoleType.POLICY_ISSUANCE_EXECUTIVE }, 'BACK_OFFICE');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow RENEWAL_EXECUTIVE to access RENEWALS workspace', () => {
      const ctx = createMockContext({ role: RoleType.RENEWAL_EXECUTIVE }, 'RENEWALS');
      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('should allow SUPER_ADMIN access to any workspace', () => {
      const ctx1 = createMockContext({ role: RoleType.SUPER_ADMIN }, 'SALES');
      const ctx2 = createMockContext({ role: RoleType.SUPER_ADMIN }, 'FINANCE');
      const ctx3 = createMockContext({ role: RoleType.SUPER_ADMIN }, 'ADMINISTRATION');

      expect(guard.canActivate(ctx1)).toBe(true);
      expect(guard.canActivate(ctx2)).toBe(true);
      expect(guard.canActivate(ctx3)).toBe(true);
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
        role: RoleType.SALES_MANAGER,
        roles: [RoleType.SALES_MANAGER, RoleType.FINANCE],
        permissions: [],
        workspaces: [],
        status: UserStatus.ACTIVE,
      };

      const permitted = resolvePermittedWorkspaces(actor);
      expect(permitted).toContain('SALES');
      expect(permitted).toContain('FINANCE');
      expect(permitted).toContain('RENEWALS');
      expect(permitted).toContain('MANAGEMENT');
      expect(permitted).not.toContain('ADMINISTRATION');
    });
  });
});
