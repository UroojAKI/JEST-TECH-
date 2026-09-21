import { ScopeResolver } from '../../src/common/services/scope-resolver.service';
import { RoleType } from '@prisma/client';

describe('Authoritative ScopeResolver Specification & Runtime Filter Suite', () => {
  let scopeResolver: ScopeResolver;

  beforeEach(() => {
    scopeResolver = new ScopeResolver();
  });

  const superAdminActor = {
    userId: 'superadmin-usr-1',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    permissions: ['*'],
    companyId: 'company-x',
    organizationId: 'company-x',
  };

  const adminActor = {
    userId: 'admin-usr-1',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    companyId: 'company-x',
    organizationId: 'company-x',
  };

  const boActor = {
    userId: 'bo-usr-1',
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    companyId: 'company-x',
    organizationId: 'company-x',
  };

  const agentActor = {
    userId: 'agent-usr-1',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    companyId: 'company-x',
    organizationId: 'company-x',
    agentId: 'agent-prof-1',
  };

  describe('ADMIN Role Scoping', () => {
    it('returns empty filter {} for platform super-admin with wildcard permissions', () => {
      const resources = ['POLICY', 'CLAIM', 'QUOTATION', 'LEAD', 'RENEWAL_TASK', 'CONTACT', 'ACCOUNT'] as const;
      for (const res of resources) {
        const filter = scopeResolver.resolveScopeFilter(superAdminActor as any, res);
        expect(filter).toEqual({});
      }
    });

    it('scopes tenant ADMIN to company/organization (not universal {})', () => {
      const resources = ['POLICY', 'CLAIM', 'QUOTATION', 'LEAD'] as const;
      for (const res of resources) {
        const filter = scopeResolver.resolveScopeFilter(adminActor as any, res);
        expect(filter).not.toEqual({});
        expect(filter.OR).toBeDefined();
        expect(filter.OR).toContainEqual({ companyId: 'company-x' });
      }
      const renewalFilter = scopeResolver.resolveScopeFilter(adminActor as any, 'RENEWAL_TASK');
      expect(renewalFilter.OR).toContainEqual({ policy: { companyId: 'company-x' } });
      expect(scopeResolver.resolveScopeFilter(adminActor as any, 'CONTACT')).toEqual({ companyId: 'company-x' });
      expect(scopeResolver.resolveScopeFilter(adminActor as any, 'ACCOUNT')).toEqual({ companyId: 'company-x' });
    });
  });

  describe('BACK_OFFICE Role Scoping', () => {
    it('scopes POLICY by companyId without referencing assignedTo', () => {
      const filter = scopeResolver.resolveScopeFilter(boActor as any, 'POLICY');
      expect(filter.OR).toBeDefined();
      expect(filter.OR).toContainEqual({ companyId: 'company-x' });
      // Invariant: Never reference non-existent assignedTo
      const serialized = JSON.stringify(filter);
      expect(serialized.includes('assignedTo')).toBe(false);
    });

    it('scopes CLAIM by companyId without referencing assignedTo', () => {
      const filter = scopeResolver.resolveScopeFilter(boActor as any, 'CLAIM');
      expect(filter.OR).toBeDefined();
      expect(filter.OR).toContainEqual({ companyId: 'company-x' });
      const serialized = JSON.stringify(filter);
      expect(serialized.includes('assignedTo')).toBe(false);
    });

    it('scopes QUOTATION by companyId without referencing assignedTo on quotation itself', () => {
      const filter = scopeResolver.resolveScopeFilter(boActor as any, 'QUOTATION');
      expect(filter.OR).toBeDefined();
      expect(filter.OR).toContainEqual({ companyId: 'company-x' });
    });
  });

  describe('AGENT Role Scoping', () => {
    it('scopes POLICY by agentId and createdById', () => {
      const filter = scopeResolver.resolveScopeFilter(agentActor as any, 'POLICY');
      expect(filter.OR).toBeDefined();
      const hasAgentId = filter.OR.some((clause: any) => clause.agentId === 'agent-prof-1');
      const hasCreatedBy = filter.OR.some((clause: any) => clause.createdById === 'agent-usr-1');
      expect(hasAgentId || hasCreatedBy).toBe(true);
      // Invariant: Never reference non-existent assignedTo on Policy
      expect(JSON.stringify(filter).includes('"assignedTo"')).toBe(false);
    });

    it('scopes CLAIM by agentId and createdById', () => {
      const filter = scopeResolver.resolveScopeFilter(agentActor as any, 'CLAIM');
      expect(filter.OR).toBeDefined();
      expect(JSON.stringify(filter).includes('"assignedTo"')).toBe(false);
    });

    it('scopes QUOTATION by agentId, createdById, and lead.assignedToId', () => {
      const filter = scopeResolver.resolveScopeFilter(agentActor as any, 'QUOTATION');
      expect(filter.OR).toBeDefined();
      expect(JSON.stringify(filter).includes('"assignedTo"')).toBe(false);
    });
  });
});
