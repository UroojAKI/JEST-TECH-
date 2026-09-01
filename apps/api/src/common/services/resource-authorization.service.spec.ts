import { ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from './resource-authorization.service';
import { ScopeResolver } from './scope-resolver.service';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('ResourceAuthorizationService & ScopeResolver', () => {
  let authzService: ResourceAuthorizationService;
  let scopeResolver: ScopeResolver;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
    scopeResolver = new ScopeResolver();
  });

  const createActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'usr-agent-a',
    email: 'agent.a@jest.com',
    firstName: 'Agent',
    lastName: 'A',
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
    branchId: 'branch-andheri',
    branchCode: 'ANDHERI',
    departmentId: 'dept-sales',
    teamId: 'team-motor-a',
    role: RoleType.SALES_AGENT,
    roles: [RoleType.SALES_AGENT],
    permissions: ['quotation.read', 'quotation.create'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
    ...overrides,
  });

  it('allows an agent to read an owned quotation', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-1', createdById: 'usr-agent-a', organizationId: 'org-mumbai',
    })).toBe(true);
  });

  it('rejects an agent reading another agent quotation', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-2', createdById: 'usr-agent-b', organizationId: 'org-mumbai',
    })).toThrow(ForbiddenException);
  });

  it('allows a team leader to access records in their team and rejects another team', () => {
    const actor = createActor({ role: RoleType.TEAM_LEADER, roles: [RoleType.TEAM_LEADER], teamId: 'team-a' });
    expect(authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-3', createdById: 'usr-agent-a', teamId: 'team-a',
    })).toBe(true);
    expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-4', createdById: 'usr-agent-b', teamId: 'team-b',
    })).toThrow(ForbiddenException);
  });

  it('allows a branch manager only inside their branch', () => {
    const actor = createActor({ role: RoleType.BRANCH_MANAGER, roles: [RoleType.BRANCH_MANAGER], branchId: 'branch-a' });
    expect(authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-5', branchId: 'branch-a', createdById: 'usr-agent-a',
    })).toBe(true);
    expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-6', branchId: 'branch-b', createdById: 'usr-agent-b',
    })).toThrow(ForbiddenException);
  });

  it('rejects cross-tenant access before role shortcuts', () => {
    const actor = createActor({ organizationId: 'org-mumbai' });
    expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-7', organizationId: 'org-delhi', createdById: 'usr-agent-z',
    })).toThrow(ForbiddenException);
  });

  it('requires organization context even for super admin', () => {
    const actor = createActor({ organizationId: undefined as any, role: RoleType.SUPER_ADMIN, roles: [RoleType.SUPER_ADMIN] });
    expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
      id: 'quote-8', createdById: 'usr-agent-z',
    })).toThrow(ForbiddenException);
  });

  it('rejects suspended and inactive users', () => {
    for (const status of [UserStatus.SUSPENDED, UserStatus.INACTIVE]) {
      const actor = createActor({ status });
      expect(() => authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-9', createdById: actor.userId,
      })).toThrow(ForbiddenException);
    }
  });

  it('allows policy issuance only to policy issuers', () => {
    const operations = createActor({ role: RoleType.POLICY_ISSUANCE_EXECUTIVE, roles: [RoleType.POLICY_ISSUANCE_EXECUTIVE] });
    const sales = createActor({ role: RoleType.SALES_AGENT, roles: [RoleType.SALES_AGENT] });
    expect(authzService.authorize(operations, 'POLICY', 'ISSUE')).toBe(true);
    expect(() => authzService.authorize(sales, 'POLICY', 'ISSUE')).toThrow(ForbiddenException);
  });

  it('allows finance reconciliation only to finance roles', () => {
    const finance = createActor({ role: RoleType.FINANCE_ACCOUNTS_EXECUTIVE, roles: [RoleType.FINANCE_ACCOUNTS_EXECUTIVE] });
    const sales = createActor({ role: RoleType.SALES_AGENT, roles: [RoleType.SALES_AGENT] });
    expect(authzService.authorize(finance, 'PAYMENT', 'RECONCILE')).toBe(true);
    expect(() => authzService.authorize(sales, 'PAYMENT', 'RECONCILE')).toThrow(ForbiddenException);
  });

  it('creates ownership scope for sales agents', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(scopeResolver.resolveScopeFilter(actor, 'QUOTATION')).toEqual({
      OR: [{ createdById: 'usr-agent-a' }, { lead: { assignedToId: 'usr-agent-a' } }],
    });
  });

  it('creates organization-scoped filters for operational roles', () => {
    const actor = createActor({ role: RoleType.OPERATIONS, roles: [RoleType.OPERATIONS] });
    expect(scopeResolver.resolveScopeFilter(actor, 'LEAD')).toEqual({
      OR: [
        { createdBy: { branch: { zone: { region: { company: { id: 'org-mumbai' } } } } } },
        { assignedTo: { branch: { zone: { region: { company: { id: 'org-mumbai' } } } } } },
      ],
    });
  });

  it('fails closed for an actor without organization context', () => {
    const actor = createActor({ organizationId: undefined as any });
    expect(scopeResolver.resolveScopeFilter(actor, 'QUOTATION')).toEqual({
      id: '__UNAUTHORIZED_ACCESS_BLOCKED__',
    });
  });
});
