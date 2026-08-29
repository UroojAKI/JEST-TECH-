import { ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from './resource-authorization.service';
import { ScopeResolver } from './scope-resolver.service';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('ResourceAuthorizationService & ScopeResolver (Iteration 3)', () => {
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

  describe('Cross-Agent Quotation Access (BOLA Elimination)', () => {
    it('should allow Sales Agent A to read own quotation', () => {
      const actorA = createActor({ userId: 'usr-agent-a' });
      const quoteA = {
        id: 'quote-1',
        createdById: 'usr-agent-a',
        organizationId: 'org-mumbai',
      };

      expect(authzService.authorize(actorA, 'QUOTATION', 'READ', quoteA)).toBe(
        true,
      );
    });

    it('should reject Sales Agent A from reading Sales Agent B quotation (BOLA Attack)', () => {
      const actorA = createActor({ userId: 'usr-agent-a' });
      const quoteB = {
        id: 'quote-2',
        createdById: 'usr-agent-b',
        organizationId: 'org-mumbai',
      };

      expect(() =>
        authzService.authorize(actorA, 'QUOTATION', 'READ', quoteB),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Organizational Hierarchy & Scope Authorization', () => {
    it('should allow Team Leader to access quotes within their team', () => {
      const leaderA = createActor({
        userId: 'usr-leader-a',
        role: RoleType.TEAM_LEADER,
        roles: [RoleType.TEAM_LEADER],
        teamId: 'team-motor-a',
      });
      const quoteInTeam = {
        id: 'quote-3',
        createdById: 'usr-agent-a',
        teamId: 'team-motor-a',
      };

      expect(
        authzService.authorize(leaderA, 'QUOTATION', 'READ', quoteInTeam),
      ).toBe(true);
    });

    it('should reject Team Leader from accessing quotes from another team', () => {
      const leaderA = createActor({
        userId: 'usr-leader-a',
        role: RoleType.TEAM_LEADER,
        roles: [RoleType.TEAM_LEADER],
        teamId: 'team-motor-a',
        branchId: 'branch-andheri',
      });
      const quoteOtherTeam = {
        id: 'quote-4',
        createdById: 'usr-agent-c',
        teamId: 'team-motor-b',
        branchId: 'branch-bandra',
      };

      expect(() =>
        authzService.authorize(leaderA, 'QUOTATION', 'READ', quoteOtherTeam),
      ).toThrow(ForbiddenException);
    });

    it('should allow Branch Manager to access all records in their branch', () => {
      const branchManager = createActor({
        userId: 'usr-bm-1',
        role: RoleType.BRANCH_MANAGER,
        roles: [RoleType.BRANCH_MANAGER],
        branchId: 'branch-andheri',
      });
      const quoteInBranch = { id: 'quote-5', branchId: 'branch-andheri' };

      expect(
        authzService.authorize(
          branchManager,
          'QUOTATION',
          'READ',
          quoteInBranch,
        ),
      ).toBe(true);
    });

    it('should allow Admin to access any record in the organization', () => {
      const admin = createActor({
        userId: 'usr-admin-1',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
      });
      const anyQuote = { id: 'quote-6', createdById: 'usr-agent-z' };

      expect(authzService.authorize(admin, 'QUOTATION', 'READ', anyQuote)).toBe(
        true,
      );
    });

    it('should reject cross-tenant access when organizationId differs', () => {
      const actor = createActor({ organizationId: 'org-mumbai' });
      const crossOrgQuote = { id: 'quote-7', organizationId: 'org-delhi' };

      expect(() =>
        authzService.authorize(actor, 'QUOTATION', 'READ', crossOrgQuote),
      ).toThrow(ForbiddenException);
    });

    it('should reject access if user account is suspended or inactive', () => {
      const suspendedActor = createActor({ status: UserStatus.SUSPENDED });
      const quote = { id: 'quote-1', createdById: suspendedActor.userId };

      expect(() =>
        authzService.authorize(suspendedActor, 'QUOTATION', 'READ', quote),
      ).toThrow(ForbiddenException);
    });
  });

  describe('Specialized Operational Actions (Issue & Reconcile)', () => {
    it('should allow OPERATIONS to issue policies and reject SALES_AGENT', () => {
      const operationsActor = createActor({
        role: RoleType.POLICY_ISSUANCE_EXECUTIVE,
        roles: [RoleType.POLICY_ISSUANCE_EXECUTIVE],
      });
      const salesActor = createActor({
        role: RoleType.SALES_AGENT,
        roles: [RoleType.SALES_AGENT],
      });

      expect(authzService.authorize(operationsActor, 'POLICY', 'ISSUE')).toBe(
        true,
      );
      expect(() =>
        authzService.authorize(salesActor, 'POLICY', 'ISSUE'),
      ).toThrow(ForbiddenException);
    });

    it('should allow FINANCE to reconcile payments and reject SALES_AGENT', () => {
      const financeActor = createActor({
        role: RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
        roles: [RoleType.FINANCE_ACCOUNTS_EXECUTIVE],
      });
      const salesActor = createActor({
        role: RoleType.SALES_AGENT,
        roles: [RoleType.SALES_AGENT],
      });

      expect(authzService.authorize(financeActor, 'PAYMENT', 'RECONCILE')).toBe(
        true,
      );
      expect(() =>
        authzService.authorize(salesActor, 'PAYMENT', 'RECONCILE'),
      ).toThrow(ForbiddenException);
    });
  });

  describe('ScopeResolver Filter Generation', () => {
    it('should generate strict OWN filter for Sales Agents (no organizationId on Quotation model)', () => {
      const salesActor = createActor({ userId: 'usr-agent-a' });
      const filter = scopeResolver.resolveScopeFilter(salesActor, 'QUOTATION');

      // Quotation model has NO organizationId column — scoping via ownership only
      expect(filter).toEqual({
        OR: [
          { createdById: 'usr-agent-a' },
          { lead: { assignedToId: 'usr-agent-a' } },
        ],
      });
    });

    it('should generate unrestricted filter for Admins and Operations (no organizationId on Lead/Policy models)', () => {
      const admin = createActor({
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
      });
      const ops = createActor({
        role: RoleType.OPERATIONS,
        roles: [RoleType.OPERATIONS],
      });

      // Quotation and Policy models have NO organizationId column — admin/ops see everything
      expect(scopeResolver.resolveScopeFilter(admin, 'QUOTATION')).toEqual({});
      expect(scopeResolver.resolveScopeFilter(ops, 'POLICY')).toEqual({});
    });

    it('should generate completely empty filter only for Super Admin without organizationId', () => {
      const globalSuperAdmin = createActor({
        organizationId: undefined,
        role: RoleType.SUPER_ADMIN,
        roles: [RoleType.SUPER_ADMIN],
      });
      expect(
        scopeResolver.resolveScopeFilter(globalSuperAdmin, 'QUOTATION'),
      ).toEqual({});
    });
  });
});
