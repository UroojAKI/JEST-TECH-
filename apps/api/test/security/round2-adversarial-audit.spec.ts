import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { RoleType, PolicyStatus, EndorsementType, DocumentVerificationStatus } from '@prisma/client';
import { SearchService } from '../../src/modules/platform/search/services/search.service';
import { WarehouseService } from '../../src/modules/warehouse/services/warehouse.service';
import { CustomersService } from '../../src/modules/customers/customers.service';
import { AgentsService } from '../../src/modules/agents/agents.service';
import { Customer360Service } from '../../src/modules/customer/customer-360/services/customer-360/customer-360.service';
import { DocumentVerificationService } from '../../src/modules/documents/services/document-verification.service';
import { EndorsementService } from '../../src/modules/endorsements/services/endorsement.service';
import { RenewalEngineService } from '../../src/modules/policies/services/renewal-engine.service';

describe('Round 2 Adversarial Security Audit Verification (Findings R2-001..R2-015)', () => {
  // =========================================================================
  // R2-001: SearchService Multi-Tenant Isolation
  // =========================================================================
  describe('[R2-001] Global Search Service Tenant Isolation', () => {
    let searchService: SearchService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        contact: { findMany: jest.fn().mockResolvedValue([]) },
        lead: { findMany: jest.fn().mockResolvedValue([]) },
        policy: { findMany: jest.fn().mockResolvedValue([]) },
        claim: { findMany: jest.fn().mockResolvedValue([]) },
        proposal: { findMany: jest.fn().mockResolvedValue([]) },
      };
      searchService = new SearchService(prismaMock);
    });

    it('rejects search requests missing companyId with ForbiddenException', async () => {
      await expect(searchService.search('rahul@example.com', '')).rejects.toThrow(
        ForbiddenException,
      );
      await expect(searchService.search('rahul@example.com', undefined)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('strictly scopes all search queries to caller companyId', async () => {
      const companyId = 'company-tenant-alpha';
      await searchService.search('9876543210', companyId);

      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, deletedAt: null }),
        }),
      );
      expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, deletedAt: null }),
        }),
      );
      expect(prismaMock.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, deletedAt: null }),
        }),
      );
      expect(prismaMock.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, deletedAt: null }),
        }),
      );
      expect(prismaMock.proposal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ quotation: { companyId } }),
        }),
      );
    });
  });

  // =========================================================================
  // R2-002 & R2-006: WarehouseService Reporting Tenancy
  // =========================================================================
  describe('[R2-002 & R2-006] Warehouse Reporting Tenancy Enforcement', () => {
    let warehouseService: WarehouseService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        contact: { findMany: jest.fn().mockResolvedValue([]) },
        lead: { findMany: jest.fn().mockResolvedValue([]) },
        policy: { findMany: jest.fn().mockResolvedValue([]) },
        claim: { findMany: jest.fn().mockResolvedValue([]) },
        policyPayment: { findMany: jest.fn().mockResolvedValue([]) },
      };
      warehouseService = new WarehouseService(prismaMock);
    });

    it('scopes contacts, leads, policies, claims, revenue, and renewals to companyId', async () => {
      const companyId = 'tenant-beta-123';

      await warehouseService.getReportingContacts(companyId);
      expect(prismaMock.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId }),
        }),
      );

      await warehouseService.getReportingLeads(companyId);
      expect(prismaMock.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId }),
        }),
      );

      await warehouseService.getReportingPolicies(companyId);
      expect(prismaMock.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId }),
        }),
      );

      await warehouseService.getReportingClaims(companyId);
      expect(prismaMock.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId }),
        }),
      );

      await warehouseService.getReportingRevenue(companyId);
      expect(prismaMock.policyPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ policy: { companyId } }),
        }),
      );

      await warehouseService.getReportingRenewals(companyId);
      expect(prismaMock.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, status: 'ACTIVE' }),
        }),
      );
    });
  });

  // =========================================================================
  // R2-003 & R2-010: CustomersService Inverted Scope & Fallback Defense
  // =========================================================================
  describe('[R2-003 & R2-010] CustomersService Scoping & Fallback Elimination', () => {
    let customersService: CustomersService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        customer: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        agent: { findUnique: jest.fn() },
        company: { findFirst: jest.fn() },
      };
      customersService = new CustomersService(prismaMock);
    });

    it('scopes findAll to user.companyId for ADMIN and BACK_OFFICE', async () => {
      const adminUser: any = {
        id: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-a',
      };

      await customersService.findAll({ page: 1, limit: 10 }, adminUser);

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-a', deletedAt: null }),
        }),
      );
    });

    it('scopes findById to user.companyId for ADMIN', async () => {
      const adminUser: any = {
        id: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-a',
      };

      await expect(
        customersService.findById('cust-from-company-b', adminUser),
      ).rejects.toThrow();

      expect(prismaMock.customer.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'cust-from-company-b',
            companyId: 'company-a',
            deletedAt: null,
          }),
        }),
      );
    });

    it('assignAgent throws ForbiddenException when actor companyId is missing (no fallback)', async () => {
      const userWithoutCompany: any = { id: 'usr-1', role: RoleType.ADMIN };

      await expect(
        customersService.assignAgent(
          'cust-1',
          { newAgentId: 'agt-1' },
          userWithoutCompany,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(prismaMock.company.findFirst).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // R2-004 & R2-008: AgentsService Cross-Tenant Creation & Stats Isolation
  // =========================================================================
  describe('[R2-004 & R2-008] AgentsService Scoping & Cross-Tenant Provisioning Guard', () => {
    let agentsService: AgentsService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        agent: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          findUnique: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        user: { findUnique: jest.fn() },
        lead: { count: jest.fn().mockResolvedValue(0) },
        motorQuotation: { findMany: jest.fn().mockResolvedValue([]) },
      };
      agentsService = new AgentsService(prismaMock);
    });

    it('scopes findAll to user.companyId for ADMIN and BACK_OFFICE', async () => {
      const adminUser: any = {
        id: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-alpha',
      };

      await agentsService.findAll({ page: 1, limit: 10 }, adminUser);

      expect(prismaMock.agent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-alpha', deletedAt: null }),
        }),
      );
    });

    it('blocks ADMIN from creating agent record for user belonging to another company', async () => {
      const adminUser: any = {
        id: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-alpha',
      };

      prismaMock.user.findUnique.mockResolvedValue({
        id: 'user-foreign',
        companyId: 'company-beta', // Belongs to different company!
      });

      await expect(
        agentsService.create(
          { userId: 'user-foreign', agencyName: 'Infiltrator Agency' } as any,
          adminUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('scopes lead and quotation stats in getAgentStats to agent.companyId', async () => {
      const adminUser: any = {
        id: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-alpha',
      };

      prismaMock.agent.findFirst.mockResolvedValue({
        id: 'agent-1',
        companyId: 'company-alpha',
        agentCode: 'AGT-0001',
      });

      await agentsService.getAgentStats('agent-1', adminUser);

      expect(prismaMock.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-alpha', agentId: 'agent-1' }),
        }),
      );
      expect(prismaMock.motorQuotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-alpha', agentId: 'agent-1' }),
        }),
      );
    });
  });

  // =========================================================================
  // R2-005: Customer360Service Sub-resource Scoping
  // =========================================================================
  describe('[R2-005] Customer360Service Nested Scoping', () => {
    let customer360Service: Customer360Service;
    let prismaMock: any;
    let authzMock: any;
    let cacheMock: any;

    beforeEach(() => {
      prismaMock = {
        contact: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'contact-1',
            companyId: 'company-a',
          }),
        },
        agent: {
          findUnique: jest.fn().mockResolvedValue({ id: 'agent-profile-1' }),
        },
        policy: { findMany: jest.fn().mockResolvedValue([]) },
        quotation: { findMany: jest.fn().mockResolvedValue([]) },
        claim: { findMany: jest.fn().mockResolvedValue([]) },
        communicationLog: { findMany: jest.fn().mockResolvedValue([]) },
        lead: { findMany: jest.fn().mockResolvedValue([]) },
        document: { findMany: jest.fn().mockResolvedValue([]) },
      };
      authzMock = { authorize: jest.fn() };
      cacheMock = { clear: jest.fn() };

      customer360Service = new Customer360Service(prismaMock, cacheMock, authzMock);
    });

    it('scopes nested policies, quotes, claims, and leads to companyId and agent for AGENT', async () => {
      const agentActor: any = {
        userId: 'agent-user-1',
        role: RoleType.AGENT,
        companyId: 'company-a',
      };

      await customer360Service.getCustomer360('contact-1', agentActor);

      expect(authzMock.authorize).toHaveBeenCalledWith(
        agentActor,
        'CUSTOMER_360',
        'READ',
        expect.any(Object),
      );

      expect(prismaMock.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-a',
            createdById: 'agent-user-1',
          }),
        }),
      );
      expect(prismaMock.quotation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'company-a',
            agentId: 'agent-profile-1',
          }),
        }),
      );
    });
  });

  // =========================================================================
  // R2-007 & R2-009: Document Verification Role & Tenant Gates
  // =========================================================================
  describe('[R2-007 & R2-009] Document Verification Authorization & Tenant Defense', () => {
    let verificationService: DocumentVerificationService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        document: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        documentAccessLog: { create: jest.fn() },
      };
      verificationService = new DocumentVerificationService(prismaMock);
    });

    it('rejects document review when actor has AGENT role', async () => {
      const agentUser: any = {
        id: 'agent-1',
        role: RoleType.AGENT,
        companyId: 'company-a',
      };

      prismaMock.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        uploadedById: 'customer-1',
        uploadedBy: { companyId: 'company-a' },
      });

      await expect(
        verificationService.startReview('doc-1', 'agent-1', '127.0.0.1', agentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects document verification when actor has AGENT role', async () => {
      const agentUser: any = {
        id: 'agent-1',
        role: RoleType.AGENT,
        companyId: 'company-a',
      };

      prismaMock.document.findFirst.mockResolvedValue({
        id: 'doc-1',
        uploadedById: 'customer-1',
        uploadedBy: { companyId: 'company-a' },
      });

      await expect(
        verificationService.submitVerification(
          'doc-1',
          { status: 'VERIFIED' },
          'agent-1',
          '127.0.0.1',
          agentUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects document verification when document belongs to another company', async () => {
      const backOfficeUser: any = {
        id: 'bo-1',
        role: RoleType.BACK_OFFICE,
        companyId: 'company-a',
      };

      prismaMock.document.findFirst.mockResolvedValue({
        id: 'doc-foreign',
        uploadedById: 'foreign-agent',
        uploadedBy: { companyId: 'company-b' }, // Company B document!
      });

      await expect(
        verificationService.submitVerification(
          'doc-foreign',
          { status: 'VERIFIED' },
          'bo-1',
          '127.0.0.1',
          backOfficeUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // =========================================================================
  // R2-014: Endorsement Financial State Tamper Defense
  // =========================================================================
  describe('[R2-014] Endorsement PREMIUM_CHANGE Financial Validation', () => {
    let endorsementService: EndorsementService;
    let prismaMock: any;

    beforeEach(() => {
      prismaMock = {
        policy: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'pol-1',
            status: 'ACTIVE',
            premiumAmount: 15000,
            effectiveDate: new Date('2026-01-01'),
            expiryDate: new Date('2026-12-31'),
            companyId: 'company-a',
          }),
          update: jest.fn(),
        },
        endorsement: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        endorsementHistory: { create: jest.fn() },
        policyHistory: { create: jest.fn() },
        auditLog: { create: jest.fn() },
        $transaction: jest.fn((cb) => cb(prismaMock)),
      };
      const numberingEngineMock = { generateNext: jest.fn().mockResolvedValue('END-001') };
      endorsementService = new EndorsementService(prismaMock, numberingEngineMock as any);
    });

    it('rejects PREMIUM_CHANGE with zero, negative, or invalid premium amount', async () => {
      prismaMock.endorsement.findUnique.mockResolvedValue({
        id: 'end-tamper',
        type: EndorsementType.PREMIUM_CHANGE,
        requestedById: 'user-1',
        status: 'REQUESTED',
        policy: {
          id: 'pol-1',
          premiumAmount: 15000,
          effectiveDate: new Date('2026-01-01'),
          expiryDate: new Date('2026-12-31'),
          companyId: 'company-a',
        },
        requestedChanges: JSON.stringify({ newAnnualPremium: 0 }),
      });

      await expect(
        endorsementService.approveEndorsement('end-tamper', 'Approved', 'user-2', {
          companyId: 'company-a',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects PREMIUM_CHANGE below statutory underwriting floor (₹100)', async () => {
      prismaMock.endorsement.findUnique.mockResolvedValue({
        id: 'end-tamper-floor',
        type: EndorsementType.PREMIUM_CHANGE,
        requestedById: 'user-1',
        status: 'REQUESTED',
        policy: {
          id: 'pol-1',
          premiumAmount: 15000,
          effectiveDate: new Date('2026-01-01'),
          expiryDate: new Date('2026-12-31'),
          companyId: 'company-a',
        },
        requestedChanges: JSON.stringify({ newAnnualPremium: 1 }), // ₹1 manipulation attempt
      });

      await expect(
        endorsementService.approveEndorsement(
          'end-tamper-floor',
          'Approved',
          'user-2',
          { companyId: 'company-a' },
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid PREMIUM_CHANGE, performs pro-rata recalculation and updates policy premium', async () => {
      prismaMock.endorsement.findUnique.mockResolvedValue({
        id: 'end-valid',
        type: EndorsementType.PREMIUM_CHANGE,
        requestedById: 'user-1',
        status: 'REQUESTED',
        policy: {
          id: 'pol-1',
          premiumAmount: 15000,
          effectiveDate: new Date('2026-01-01'),
          expiryDate: new Date('2026-12-31'),
          companyId: 'company-a',
        },
        requestedChanges: JSON.stringify({ newAnnualPremium: 25000 }),
      });

      await endorsementService.approveEndorsement('end-valid', 'Approved', 'user-2', {
        companyId: 'company-a',
      });

      expect(prismaMock.policy.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pol-1' },
          data: expect.objectContaining({
            premiumAmount: expect.any(Object),
          }),
        }),
      );
      expect(prismaMock.auditLog.create).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // R2-015: RenewalEngineService Identity Neutralization
  // =========================================================================
  describe('[R2-015] RenewalEngineService Actor Context Neutralization', () => {
    let renewalEngine: RenewalEngineService;
    let prismaMock: any;
    let queueMock: any;

    beforeEach(() => {
      prismaMock = {
        policy: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue(null),
          count: jest.fn().mockResolvedValue(0),
        },
        renewalTask: { upsert: jest.fn() },
      };
      queueMock = { add: jest.fn() };
      renewalEngine = new RenewalEngineService(prismaMock, queueMock);
    });

    it('enforces companyId in buildPolicyScope even for ADMIN (never returns empty filter {})', async () => {
      const adminActor: any = {
        userId: 'admin-1',
        role: RoleType.ADMIN,
        companyId: 'company-x',
      };

      await renewalEngine.getRenewalPipeline(adminActor, { page: 1, limit: 10 });

      expect(prismaMock.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'company-x' }),
        }),
      );
    });

    it('throws ForbiddenException when actor companyId is missing or "system"', async () => {
      const invalidActor: any = {
        userId: 'system-actor',
        role: RoleType.ADMIN,
        companyId: '',
      };

      await expect(
        renewalEngine.getRenewalPipeline(invalidActor, { page: 1, limit: 10 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
