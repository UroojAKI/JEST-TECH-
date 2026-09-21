import { ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from './resource-authorization.service';
import { ScopeResolver } from './scope-resolver.service';
import { GetQuotationService } from '../../modules/quotation/services/queries/get-quotation.service';
import { GetPolicyService } from '../../modules/policies/services/queries/get-policy.service';
import { LeadsService } from '../../modules/leads/services/leads.service';
import { GetClaimsService } from '../../modules/claims/services/queries/get-claims.service';
import { ActorContext } from '../interfaces/actor-context.interface';

describe('BOLA & Multi-User Authorization Suite (R1 Exit Gate)', () => {
  let authzService: ResourceAuthorizationService;
  let scopeResolver: ScopeResolver;
  let getQuotationService: GetQuotationService;
  let getPolicyService: GetPolicyService;
  let leadsService: LeadsService;
  let getClaimsService: GetClaimsService;

  let mockQuotationRepo: any;
  let mockPolicyRepo: any;
  let mockLeadRepo: any;
  let mockClaimRepo: any;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
    scopeResolver = new ScopeResolver();

    mockQuotationRepo = {
      findDetail: jest.fn(),
      findAll: jest.fn(),
    };

    mockPolicyRepo = {
      findDetail: jest.fn(),
      findPaginated: jest.fn(),
    };

    mockLeadRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
    };

    mockClaimRepo = {
      findById: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
    };

    getQuotationService = new GetQuotationService(
      mockQuotationRepo,
      authzService,
      scopeResolver,
    );

    getPolicyService = new GetPolicyService(
      mockPolicyRepo,
      authzService,
      scopeResolver,
    );

    leadsService = new LeadsService(
      mockLeadRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      authzService,
      scopeResolver,
    );

    getClaimsService = new GetClaimsService(
      mockClaimRepo,
      authzService,
      scopeResolver,
    );
  });

  const createActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'usr-agent-1',
    email: 'agent1@jest.com',
    firstName: 'Agent',
    lastName: 'One',
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
    branchId: 'br-andheri',
    branchCode: 'ANDHERI',
    departmentId: 'dept-sales',
    teamId: 'team-alpha',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: [],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
    ...overrides,
  });

  describe('1. Quotation BOLA Prevention', () => {
    it('should allow agent to view own quotation', async () => {
      const actor = createActor({ userId: 'usr-agent-1' });
      mockQuotationRepo.findDetail.mockResolvedValue({
        id: 'q-100',
        quotationCode: 'QTN-000100',
        createdById: 'usr-agent-1',
        organizationId: 'org-mumbai',
        versions: [],
        addons: [],
        discounts: [],
      });

      const result = await getQuotationService.executeOne('q-100', actor);
      expect(result).toBeDefined();
    });

    it('should reject agent attempting to view another agent quotation (BOLA Attack)', async () => {
      const actor = createActor({ userId: 'usr-agent-1' });
      mockQuotationRepo.findDetail.mockResolvedValue({
        id: 'q-200',
        quotationCode: 'QTN-000200',
        createdById: 'usr-agent-2',
        organizationId: 'org-mumbai',
        versions: [],
        addons: [],
        discounts: [],
      });

      await expect(
        getQuotationService.executeOne('q-200', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('2. Policy BOLA Prevention', () => {
    it('should reject agent attempting to view another agent policy', async () => {
      const actor = createActor({ userId: 'usr-agent-1' });
      mockPolicyRepo.findDetail.mockResolvedValue({
        id: 'pol-500',
        policyNumber: 'POL-000500',
        createdById: 'usr-agent-2',
        organizationId: 'org-mumbai',
        status: 'ACTIVE',
      });

      await expect(
        getPolicyService.executeOne('pol-500', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('3. Lead BOLA Prevention', () => {
    it('should reject agent attempting to read or update unassigned lead', async () => {
      const actor = createActor({ userId: 'usr-agent-1' });
      mockLeadRepo.findById.mockResolvedValue({
        id: 'lead-888',
        title: 'High Net Worth Motor Lead',
        createdById: 'usr-agent-99',
        assignedToId: 'usr-agent-99',
        organizationId: 'org-mumbai',
      });

      await expect(leadsService.findById('lead-888', actor)).rejects.toThrow(
        ForbiddenException,
      );

      await expect(
        leadsService.update('lead-888', {} as any, actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('4. Claim BOLA Prevention', () => {
    it('should reject agent attempting to view unrelated customer claim', async () => {
      const actor = createActor({ userId: 'usr-agent-1' });
      mockClaimRepo.findById.mockResolvedValue({
        id: 'clm-900',
        claimNumber: 'CLM-000900',
        createdById: 'usr-customer-42',
        policy: { createdById: 'usr-agent-2' },
        organizationId: 'org-mumbai',
      });

      await expect(
        getClaimsService.executeOne('clm-900', actor),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('5. Document & Payment BOLA Prevention', () => {
    it('should reject Agent A attempting to read Agent B document', () => {
      const agentA = createActor({ userId: 'usr-agent-1' });
      const docB = {
        id: 'doc-200',
        createdById: 'usr-agent-2',
        organizationId: 'org-mumbai',
      };

      expect(() => {
        authzService.authorize(agentA, 'DOCUMENT', 'READ', docB);
      }).toThrow(ForbiddenException);
    });

    it('should reject Agent A attempting to read Agent B payment', () => {
      const agentA = createActor({ userId: 'usr-agent-1' });
      const paymentB = {
        id: 'pay-200',
        createdById: 'usr-agent-2',
        organizationId: 'org-mumbai',
      };

      expect(() => {
        authzService.authorize(agentA, 'PAYMENT', 'READ', paymentB);
      }).toThrow(ForbiddenException);
    });

    it('should reject Agent A attempting to read Agent B renewal task', () => {
      const agentA = createActor({ userId: 'usr-agent-1' });
      const renewalB = {
        id: 'ren-200',
        assignedToId: 'usr-agent-2',
        organizationId: 'org-mumbai',
      };

      expect(() => {
        authzService.authorize(agentA, 'RENEWAL_TASK', 'READ', renewalB);
      }).toThrow(ForbiddenException);
    });
  });

  describe('6. Cross-Role Operation Boundary Enforcement', () => {
    it('should forbid Agent from issuing a policy', () => {
      const salesAgent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
      });

      expect(() => {
        authzService.authorize(salesAgent, 'POLICY', 'ISSUE', {});
      }).toThrow(ForbiddenException);
    });

    it('should forbid Agent from creating policies directly', () => {
      const salesAgent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
      });

      expect(authzService.canCreate(salesAgent, 'POLICY')).toBe(false);
    });

    it('should forbid Sales Agent from reconciling payments', () => {
      const salesAgent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
      });

      expect(() => {
        authzService.authorize(salesAgent, 'PAYMENT', 'RECONCILE', {});
      }).toThrow(ForbiddenException);
    });

    it('should forbid Agent from approving quotations', () => {
      const salesAgent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
      });

      expect(() => {
        authzService.authorize(salesAgent, 'QUOTATION', 'APPROVE', {});
      }).toThrow(ForbiddenException);
    });

    it('should allow Back Office to approve quotations', () => {
      const boUser = createActor({
        userId: 'usr-bo-1',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
      });

      expect(authzService.authorize(boUser, 'QUOTATION', 'APPROVE', {})).toBe(true);
    });
  });

  describe('7. Multi-User Hierarchical Scoping (Branch & Team)', () => {
    it('should allow Back Office accessing resource across branches within organization', () => {
      const branchManagerAndheri = createActor({
        userId: 'usr-mgr-andheri',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        branchId: 'br-andheri',
      });

      const bandraResource = {
        id: 'res-bandra-1',
        branchId: 'br-bandra',
        organizationId: 'org-mumbai',
      };

      expect(
        authzService.authorize(
          branchManagerAndheri,
          'LEAD',
          'READ',
          bandraResource,
        ),
      ).toBe(true);
    });

    it('should reject Agent accessing resource of another branch and agent', () => {
      const agentAlpha = createActor({
        userId: 'usr-agent-alpha',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
        branchId: 'br-andheri',
        teamId: 'team-alpha',
      });

      const otherBranchTeamResource = {
        id: 'res-beta-1',
        createdById: 'usr-agent-beta',
        branchId: 'br-bandra',
        teamId: 'team-beta',
        organizationId: 'org-mumbai',
      };

      expect(() => {
        authzService.authorize(
          agentAlpha,
          'LEAD',
          'READ',
          otherBranchTeamResource,
        );
      }).toThrow(ForbiddenException);
    });
  });

  describe('8. Account Status & Authentication Validation', () => {
    it('should reject suspended user from accessing any resource', () => {
      const suspendedUser = createActor({
        userId: 'usr-suspended-1',
        status: UserStatus.SUSPENDED,
      });

      expect(() => {
        authzService.authorize(suspendedUser, 'LEAD', 'READ', { id: 'l-1' });
      }).toThrow(ForbiddenException);
    });

    it('should reject unauthenticated actor without userId', () => {
      expect(() => {
        authzService.authorize({} as any, 'LEAD', 'READ', { id: 'l-1' });
      }).toThrow(ForbiddenException);
    });
  });

  describe('9. Multi-Tenant Cross-Organization Isolation', () => {
    it('should strictly reject Back Office attempting to access resource of another organization', async () => {
      const boOrgA = createActor({
        userId: 'usr-bo-a',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      });

      mockQuotationRepo.findDetail.mockResolvedValue({
        id: 'q-tenant-b',
        createdById: 'usr-agent-delhi',
        organizationId: 'org-delhi',
        versions: [],
        addons: [],
        discounts: [],
      });

      await expect(
        getQuotationService.executeOne('q-tenant-b', boOrgA),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('10. Assignment Boundary Enforcement', () => {
    it('should reject Sales Agent attempting to assign a lead', () => {
      const salesAgent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
      });

      expect(() => {
        authzService.authorize(salesAgent, 'LEAD', 'ASSIGN', { id: 'lead-1' });
      }).toThrow(ForbiddenException);
    });

    it('should reject Back Office attempting to assign a lead outside their organization', () => {
      const bo = createActor({
        userId: 'usr-bo-alpha',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      });

      const leadDelhi = {
        id: 'lead-delhi',
        organizationId: 'org-delhi',
        companyId: 'org-delhi',
      };

      expect(() => {
        authzService.authorize(bo, 'LEAD', 'ASSIGN', leadDelhi);
      }).toThrow(ForbiddenException);
    });

    it('should allow Back Office to assign a lead across branches within their organization', () => {
      const bo = createActor({
        userId: 'usr-bo-andheri',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        branchId: 'br-andheri',
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      });

      const leadBandra = {
        id: 'lead-bandra',
        branchId: 'br-bandra',
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      };

      expect(
        authzService.authorize(
          bo,
          'LEAD',
          'ASSIGN',
          leadBandra,
        ),
      ).toBe(true);
    });
  });

  describe('11. ScopeResolver Multi-Tenant Anchoring', () => {
    it('should return empty filter for Super Admin (system-global)', () => {
      const superAdmin = createActor({
        userId: 'usr-super-1',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        permissions: ['*'],
        organizationId: 'org-mumbai',
      });

      const filter = scopeResolver.resolveScopeFilter(superAdmin, 'LEAD');
      expect(filter).toEqual({});
    });

    it('should return organization-scoped filter for Tenant Admin', () => {
      const tenantAdmin = createActor({
        userId: 'usr-admin-tenant',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      });

      const filter = scopeResolver.resolveScopeFilter(tenantAdmin, 'LEAD');
      expect(filter.OR).toBeDefined();
      expect(filter.OR).toContainEqual({ companyId: 'org-mumbai' });
    });

    it('should return organization-scoped filter for Back Office (scoped to company/branch hierarchy)', () => {
      const bo = createActor({
        userId: 'usr-bo-1',
        role: RoleType.BACK_OFFICE,
        roles: [RoleType.BACK_OFFICE],
        organizationId: 'org-mumbai',
        companyId: 'org-mumbai',
      });

      const filter = scopeResolver.resolveScopeFilter(bo, 'LEAD');
      expect(filter).toEqual({
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

    it('should fail-closed for Admin without organization context', () => {
      const admin = createActor({
        userId: 'usr-admin-1',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        organizationId: undefined,
        companyId: undefined,
      });

      const filter = scopeResolver.resolveScopeFilter(admin, 'LEAD');
      expect(filter).toEqual({ id: '__UNAUTHORIZED_ACCESS_BLOCKED__' });
    });

    it('should generate ownership-only filter for Sales Agent in Lead filter (Lead has no organizationId column)', () => {
      const agent = createActor({
        userId: 'usr-agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
        organizationId: 'org-mumbai',
      });

      // Lead model has NO organizationId column — scoping via ownership only
      const filter = scopeResolver.resolveScopeFilter(agent, 'LEAD');
      expect(filter).toEqual({
        OR: [{ assignedToId: 'usr-agent-1' }, { createdById: 'usr-agent-1' }],
      });
    });
  });

  describe('12. Nested Relation Ownership Authorization', () => {
    it('should allow Sales Agent to view quotation when agent is the assigned lead owner', () => {
      const agent = createActor({ userId: 'usr-agent-1' });
      const quotation = {
        id: 'q-nested-1',
        createdById: 'usr-agent-other',
        organizationId: 'org-mumbai',
        lead: { assignedToId: 'usr-agent-1' },
      };

      expect(
        authzService.authorize(agent, 'QUOTATION', 'READ', quotation),
      ).toBe(true);
    });
  });
});
