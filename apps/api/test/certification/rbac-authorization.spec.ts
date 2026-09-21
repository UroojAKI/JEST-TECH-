import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { ROLES_KEY } from '../../src/modules/auth/decorators/roles.decorator';

describe('Authoritative RBAC Authorization Certification Suite', () => {
  let reflector: Reflector;
  let rolesGuard: RolesGuard;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  const createMockExecutionContext = (
    user: any,
    handlerRoles?: RoleType[],
    classRoles?: RoleType[],
  ) => {
    const handler = () => {};
    const targetClass = class {};

    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === ROLES_KEY) {
          return handlerRoles || classRoles;
        }
        return undefined;
      });

    return {
      getHandler: () => handler,
      getClass: () => targetClass,
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;
  };

  describe('RBAC-001: ADMIN Universal Access', () => {
    it('grants ADMIN role access across endpoints requiring any role', () => {
      const adminUser = {
        id: 'usr-admin',
        role: RoleType.ADMIN,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(adminUser, [
        RoleType.BACK_OFFICE,
        RoleType.AGENT,
      ]);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('grants ADMIN role access to ADMIN-only endpoints', () => {
      const adminUser = {
        id: 'usr-admin',
        role: RoleType.ADMIN,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(adminUser, [RoleType.ADMIN]);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });

  describe('RBAC-002: BACK_OFFICE Role Scoping & Isolation', () => {
    it('grants BACK_OFFICE access to operational endpoints', () => {
      const boUser = {
        id: 'usr-bo',
        role: RoleType.BACK_OFFICE,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(boUser, [
        RoleType.ADMIN,
        RoleType.BACK_OFFICE,
      ]);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('forbids BACK_OFFICE from ADMIN-only endpoints with 403 Forbidden', () => {
      const boUser = {
        id: 'usr-bo',
        role: RoleType.BACK_OFFICE,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(boUser, [RoleType.ADMIN]);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('RBAC-003: AGENT Role Scoping & Isolation', () => {
    it('grants AGENT access to agent/sales authorized endpoints', () => {
      const agentUser = {
        id: 'usr-agent',
        role: RoleType.AGENT,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(agentUser, [
        RoleType.ADMIN,
        RoleType.BACK_OFFICE,
        RoleType.AGENT,
      ]);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('forbids AGENT from Back Office approval & finance endpoints with 403 Forbidden', () => {
      const agentUser = {
        id: 'usr-agent',
        role: RoleType.AGENT,
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(agentUser, [
        RoleType.ADMIN,
        RoleType.BACK_OFFICE,
      ]);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe('RBAC-004: Unauthenticated Requests', () => {
    it('returns false when request has no authenticated user', () => {
      const context = createMockExecutionContext(null, [
        RoleType.ADMIN,
        RoleType.AGENT,
      ]);
      expect(rolesGuard.canActivate(context)).toBe(false);
    });
  });

  describe('RBAC-005: Session Preservation on 403', () => {
    it('rejects unauthorized request with 403 without invalidating session or destroying credentials', () => {
      const agentUser = {
        id: 'usr-agent',
        role: RoleType.AGENT,
        companyId: 'org-1',
        sessionValid: true,
      };
      const context = createMockExecutionContext(agentUser, [RoleType.ADMIN]);
      try {
        rolesGuard.canActivate(context);
        fail('Should have thrown ForbiddenException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ForbiddenException);
        expect(agentUser.sessionValid).toBe(true);
      }
    });
  });

  describe('RBAC-006: Multi-Role Evaluation', () => {
    it('grants access if any role in user.roles satisfies the required endpoint roles', () => {
      const multiRoleUser = {
        id: 'usr-multi',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT, RoleType.BACK_OFFICE],
        companyId: 'org-1',
      };
      const context = createMockExecutionContext(multiRoleUser, [
        RoleType.BACK_OFFICE,
      ]);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });
  });
});
