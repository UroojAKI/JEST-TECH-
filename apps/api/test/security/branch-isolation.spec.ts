import { ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { TenantAuthorizationService } from '../../src/common/tenancy/tenant-authorization.service';
import { CrossTenantException, CrossBranchException } from '../../src/common/tenancy/tenant-exception';
import { actorScope, companyScope, branchScope } from '../../src/common/tenancy/tenant-scope';
import { ClaimPolicy } from '../../src/common/policies/claim.policy';
import { PolicyPolicy } from '../../src/common/policies/policy.policy';
import { LeadPolicy } from '../../src/common/policies/lead.policy';

/**
 * Sprint 8.3: Branch Isolation & Hierarchy Acceptance Suite
 *
 * Authorization Invariants (Locked Decisions):
 * 1. ADMIN Company A can access all branches of Company A (A1, A2, A3), NEVER Company B.
 * 2. BACK_OFFICE Company A with branchId = null -> company-wide (A1, A2, A3).
 * 3. BACK_OFFICE Company A with branchId = A1 -> Branch A1 only. Denied Branch A2.
 * 4. AGENT Company A -> Branch A1 assigned records only.
 * 5. Company B -> NEVER sees Company A records regardless of role.
 */
describe('Sprint 8.3: Branch Isolation & Hierarchy Suite', () => {
  let tenantAuth: TenantAuthorizationService;
  let claimPolicy: ClaimPolicy;
  let policyPolicy: PolicyPolicy;
  let leadPolicy: LeadPolicy;

  beforeEach(() => {
    tenantAuth = new TenantAuthorizationService();
    claimPolicy = new ClaimPolicy();
    policyPolicy = new PolicyPolicy();
    leadPolicy = new LeadPolicy();
  });

  const companyA = 'comp-alpha';
  const companyB = 'comp-beta';

  const branchA1 = 'branch-a1';
  const branchA2 = 'branch-a2';
  const branchB1 = 'branch-b1';

  // Personas
  const adminA: any = {
    userId: 'usr-admin-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    branchId: null,
    status: UserStatus.ACTIVE,
  };

  const boCompanyWideA: any = {
    userId: 'usr-bo-global-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    branchId: null, // Q1: NULL = company-wide
    status: UserStatus.ACTIVE,
  };

  const boBranchA1: any = {
    userId: 'usr-bo-branch-a1',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    branchId: branchA1, // Branch-restricted
    status: UserStatus.ACTIVE,
  };

  const agentA1: any = {
    userId: 'usr-agent-a1',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    branchId: branchA1,
    status: UserStatus.ACTIVE,
  };

  const adminB: any = {
    userId: 'usr-admin-b',
    companyId: companyB,
    organizationId: companyB,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    branchId: null,
    status: UserStatus.ACTIVE,
  };

  // Resources
  const leadA1 = {
    id: 'lead-a1',
    companyId: companyA,
    branchId: branchA1,
    createdById: agentA1.userId,
  };

  const leadA2 = {
    id: 'lead-a2',
    companyId: companyA,
    branchId: branchA2,
    createdById: 'other-agent-a2',
  };

  const leadB1 = {
    id: 'lead-b1',
    companyId: companyB,
    branchId: branchB1,
    createdById: 'agent-b1',
  };

  describe('1. TenantScope Primitives', () => {
    it('companyScope always derives from actor.companyId', () => {
      expect(companyScope(adminA)).toEqual({ companyId: companyA });
      expect(companyScope(boBranchA1)).toEqual({ companyId: companyA });
      expect(companyScope(adminB)).toEqual({ companyId: companyB });
    });

    it('branchScope preserves branchId for branch-scoped users', () => {
      expect(branchScope(boBranchA1)).toEqual({
        companyId: companyA,
        branchId: branchA1,
      });
      expect(branchScope(agentA1)).toEqual({
        companyId: companyA,
        branchId: branchA1,
      });
    });

    it('branchScope falls back to companyId for company-wide users with null branchId', () => {
      expect(branchScope(adminA)).toEqual({ companyId: companyA });
      expect(branchScope(boCompanyWideA)).toEqual({ companyId: companyA });
    });

    it('actorScope provides correct boundaries per role', () => {
      expect(actorScope(adminA)).toEqual({ companyId: companyA });
      expect(actorScope(boCompanyWideA)).toEqual({ companyId: companyA });
      expect(actorScope(boBranchA1)).toEqual({
        companyId: companyA,
        branchId: branchA1,
      });
    });
  });

  describe('2. TenantAuthorizationService: Company Boundary Verification', () => {
    it('allows same company access', () => {
      expect(() => tenantAuth.assertSameCompany(adminA, companyA)).not.toThrow();
      expect(() => tenantAuth.assertSameCompany(boBranchA1, companyA)).not.toThrow();
    });

    it('rejects cross-company access (Company A -> Company B)', () => {
      expect(() => tenantAuth.assertSameCompany(adminA, companyB)).toThrow(
        CrossTenantException,
      );
      expect(() => tenantAuth.assertSameCompany(boBranchA1, companyB)).toThrow(
        CrossTenantException,
      );
    });

    it('rejects cross-company access (Company B -> Company A)', () => {
      expect(() => tenantAuth.assertSameCompany(adminB, companyA)).toThrow(
        CrossTenantException,
      );
    });

    it('fails closed when resource has no company attribution', () => {
      expect(() => tenantAuth.assertSameCompany(adminA, null)).toThrow(
        CrossTenantException,
      );
      expect(() => tenantAuth.assertSameCompany(adminA, undefined)).toThrow(
        CrossTenantException,
      );
    });
  });

  describe('3. TenantAuthorizationService: Branch Boundary Verification', () => {
    it('company-wide BACK_OFFICE (branchId=null) can access any branch within company', () => {
      expect(() => tenantAuth.assertSameBranch(boCompanyWideA, branchA1)).not.toThrow();
      expect(() => tenantAuth.assertSameBranch(boCompanyWideA, branchA2)).not.toThrow();
    });

    it('branch-restricted BACK_OFFICE (branchId=A1) can access Branch A1', () => {
      expect(() => tenantAuth.assertSameBranch(boBranchA1, branchA1)).not.toThrow();
    });

    it('branch-restricted BACK_OFFICE (branchId=A1) is rejected from Branch A2', () => {
      expect(() => tenantAuth.assertSameBranch(boBranchA1, branchA2)).toThrow(
        CrossBranchException,
      );
    });

    it('ADMIN (branchId=null) can access all branches in own company', () => {
      expect(() => tenantAuth.assertSameBranch(adminA, branchA1)).not.toThrow();
      expect(() => tenantAuth.assertSameBranch(adminA, branchA2)).not.toThrow();
    });
  });

  describe('4. Policy Isolation Matrix (ADMIN ≠ Global)', () => {
    it('ADMIN A can read leads in Company A, but NEVER Company B', () => {
      expect(leadPolicy.canRead(adminA, leadA1)).toBe(true);
      expect(leadPolicy.canRead(adminA, leadA2)).toBe(true);
      expect(leadPolicy.canRead(adminA, leadB1)).toBe(false);
    });

    it('ADMIN B can read leads in Company B, but NEVER Company A', () => {
      expect(leadPolicy.canRead(adminB, leadB1)).toBe(true);
      expect(leadPolicy.canRead(adminB, leadA1)).toBe(false);
      expect(leadPolicy.canRead(adminB, leadA2)).toBe(false);
    });

    it('BACK_OFFICE A can read leads in Company A, but NEVER Company B', () => {
      expect(leadPolicy.canRead(boBranchA1, leadA1)).toBe(true);
      expect(leadPolicy.canRead(boBranchA1, leadB1)).toBe(false);
    });

    it('AGENT A1 can read own lead, but not leads created by other agents or in other companies', () => {
      expect(leadPolicy.canRead(agentA1, leadA1)).toBe(true);
      expect(leadPolicy.canRead(agentA1, leadA2)).toBe(false);
      expect(leadPolicy.canRead(agentA1, leadB1)).toBe(false);
    });
  });

  describe('5. Claim Creation Authority (Q5 Locked Rule)', () => {
    it('BACK_OFFICE is authorized to create claims', () => {
      expect(claimPolicy.canCreate(boBranchA1)).toBe(true);
      expect(claimPolicy.canCreate(boCompanyWideA)).toBe(true);
    });

    it('ADMIN is authorized to manage claims', () => {
      expect(claimPolicy.canCreate(adminA)).toBe(true);
    });

    it('AGENT is strictly DENIED from creating claims (Q5)', () => {
      expect(claimPolicy.canCreate(agentA1)).toBe(false);
    });
  });
});
