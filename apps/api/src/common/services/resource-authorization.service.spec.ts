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
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: ['quotation.read', 'quotation.create'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
    ...overrides,
  });

  const resourceOrg = {
    createdBy: {
      branch: { zone: { region: { company: { id: 'org-mumbai' } } } },
      branchId: 'branch-andheri',
      teamId: 'team-motor-a',
    },
  };

  it('allows an agent to read an owned quotation', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-1',
        createdById: 'usr-agent-a',
        ...resourceOrg,
      }),
    ).toBe(true);
  });

  it('rejects an agent reading another agent quotation', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(() =>
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-2',
        createdById: 'usr-agent-b',
        ...resourceOrg,
      }),
    ).toThrow(ForbiddenException);
  });

  it('allows back office to access records across the organization', () => {
    const actor = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
    });
    expect(
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-3',
        createdById: 'usr-agent-a',
        ...resourceOrg,
        createdBy: { ...resourceOrg.createdBy, teamId: 'team-a' },
      }),
    ).toBe(true);
    expect(
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-4',
        createdById: 'usr-agent-b',
        ...resourceOrg,
        createdBy: { ...resourceOrg.createdBy, teamId: 'team-b' },
      }),
    ).toBe(true);
  });

  it('rejects agent accessing out-of-scope branch record', () => {
    const actor = createActor({
      role: RoleType.AGENT,
      roles: [RoleType.AGENT],
      userId: 'usr-agent-a',
    });
    const outBranch = {
      ...resourceOrg,
      createdBy: { ...resourceOrg.createdBy, branchId: 'branch-b' },
    };
    expect(() =>
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-6',
        createdById: 'usr-agent-b',
        ...outBranch,
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects cross-tenant access before role shortcuts', () => {
    const actor = createActor({ organizationId: 'org-mumbai' });
    expect(() =>
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-7',
        organizationId: 'org-delhi',
        createdById: 'usr-agent-z',
      }),
    ).toThrow(ForbiddenException);
  });

  it('requires organization context even for super admin', () => {
    const actor = createActor({
      organizationId: undefined,
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
    });
    expect(() =>
      authzService.authorize(actor, 'QUOTATION', 'READ', {
        id: 'quote-8',
        createdById: 'usr-agent-z',
      }),
    ).toThrow(ForbiddenException);
  });

  it('rejects suspended and inactive users', () => {
    for (const status of [UserStatus.SUSPENDED, UserStatus.INACTIVE]) {
      const actor = createActor({ status });
      expect(() =>
        authzService.authorize(actor, 'QUOTATION', 'READ', {
          id: 'quote-9',
          createdById: actor.userId,
          ...resourceOrg,
        }),
      ).toThrow(ForbiddenException);
    }
  });

  it('allows policy issuance only to policy issuers', () => {
    const operations = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
    });
    const nonIssuer = createActor({
      role: RoleType.AGENT,
      roles: [RoleType.AGENT],
    });
    expect(authzService.authorize(operations, 'POLICY', 'ISSUE')).toBe(true);
    expect(() => authzService.authorize(nonIssuer, 'POLICY', 'ISSUE')).toThrow(
      ForbiddenException,
    );
  });

  it('allows finance reconciliation only to finance roles', () => {
    const finance = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
    });
    const sales = createActor({
      role: RoleType.AGENT,
      roles: [RoleType.AGENT],
    });
    expect(authzService.authorize(finance, 'PAYMENT', 'RECONCILE')).toBe(true);
    expect(() => authzService.authorize(sales, 'PAYMENT', 'RECONCILE')).toThrow(
      ForbiddenException,
    );
  });

  it('creates ownership scope for sales agents', () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    expect(scopeResolver.resolveScopeFilter(actor, 'QUOTATION')).toEqual({
      OR: [
        { createdById: 'usr-agent-a' },
        { lead: { assignedToId: 'usr-agent-a' } },
      ],
    });
  });

  it('creates organization-scoped filters for operational roles', () => {
    const actor = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
    });
    expect(scopeResolver.resolveScopeFilter(actor, 'LEAD')).toEqual({
      OR: [
        { companyId: 'org-mumbai' },
        {
          createdBy: {
            OR: [
              { companyId: 'org-mumbai' },
              {
                branch: { zone: { region: { company: { id: 'org-mumbai' } } } },
              },
            ],
          },
        },
        {
          assignedTo: {
            OR: [
              { companyId: 'org-mumbai' },
              {
                branch: { zone: { region: { company: { id: 'org-mumbai' } } } },
              },
            ],
          },
        },
      ],
    });
  });

  it('fails closed for an actor without organization context', () => {
    const actor = createActor({ organizationId: undefined });
    expect(scopeResolver.resolveScopeFilter(actor, 'QUOTATION')).toEqual({
      id: '__UNAUTHORIZED_ACCESS_BLOCKED__',
    });
  });

  it('fails closed for Admin without organization context', () => {
    const admin = createActor({
      role: RoleType.ADMIN,
      roles: [RoleType.ADMIN],
      organizationId: undefined,
    });
    expect(scopeResolver.resolveScopeFilter(admin, 'LEAD')).toEqual({
      id: '__UNAUTHORIZED_ACCESS_BLOCKED__',
    });
  });

  it('fails closed for Operations without organization context', () => {
    const ops = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
      organizationId: undefined,
    });
    expect(scopeResolver.resolveScopeFilter(ops, 'POLICY')).toEqual({
      id: '__UNAUTHORIZED_ACCESS_BLOCKED__',
    });
  });

  it('fails closed for Branch Manager without organization context', () => {
    const bm = createActor({
      role: RoleType.BACK_OFFICE,
      roles: [RoleType.BACK_OFFICE],
      organizationId: undefined,
    });
    expect(scopeResolver.resolveScopeFilter(bm, 'CLAIM')).toEqual({
      id: '__UNAUTHORIZED_ACCESS_BLOCKED__',
    });
  });
});
