import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from '../../src/common/services/resource-authorization.service';
import { ScopeResolver } from '../../src/common/services/scope-resolver.service';
import { GetQuotationService } from '../../src/modules/quotation/services/queries/get-quotation.service';
import { GetPolicyService } from '../../src/modules/policies/services/queries/get-policy.service';
import { LeadsService } from '../../src/modules/leads/services/leads.service';
import { GetClaimsService } from '../../src/modules/claims/services/queries/get-claims.service';
import { ActorContext } from '../../src/common/interfaces/actor-context.interface';

describe('BOLA & Multi-Tenant Security Suite (Iteration 4)', () => {
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
    role: RoleType.SALES_AGENT,
    roles: [RoleType.SALES_AGENT],
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
        createdById: 'usr-agent-2', // Belong to agent 2!
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

      await expect(
        leadsService.findById('lead-888', actor),
      ).rejects.toThrow(ForbiddenException);

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

  describe('5. Multi-Tenant Cross-Organization Isolation', () => {
    it('should strictly reject Admin attempting to access resource of another organization', async () => {
      const adminOrgA = createActor({
        userId: 'usr-admin-a',
        role: RoleType.ADMIN,
        roles: [RoleType.ADMIN],
        organizationId: 'org-mumbai',
      });

      mockQuotationRepo.findDetail.mockResolvedValue({
        id: 'q-tenant-b',
        createdById: 'usr-agent-delhi',
        organizationId: 'org-delhi', // Different organization!
        versions: [],
        addons: [],
        discounts: [],
      });

      await expect(
        getQuotationService.executeOne('q-tenant-b', adminOrgA),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
