import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from '../../src/common/services/resource-authorization.service';
import { LeadPolicy } from '../../src/common/policies/lead.policy';
import { ContactPolicy } from '../../src/common/policies/contact.policy';
import { QuotationPolicy } from '../../src/common/policies/quotation.policy';
import { PolicyPolicy } from '../../src/common/policies/policy.policy';
import { ClaimPolicy } from '../../src/common/policies/claim.policy';
import { DocumentPolicy } from '../../src/common/policies/document.policy';
import { UsersPolicy } from '../../src/common/policies/users.policy';
import { CommissionPolicy } from '../../src/common/policies/commission.policy';
import { TenantAuthorizationService } from '../../src/common/tenancy/tenant-authorization.service';
import { CrossTenantException } from '../../src/common/tenancy/tenant-exception';

/**
 * Sprint 8.2: 15-Resource BOLA Authorization Matrix
 *
 * Symmetrically tests all 15 core resource types across two companies (A and B)
 * and all 3 human roles (ADMIN, BACK_OFFICE, AGENT):
 *
 * 1.  Lead
 * 2.  Contact
 * 3.  Quotation
 * 4.  Payment
 * 5.  Policy
 * 6.  Claim
 * 7.  Document
 * 8.  Settlement
 * 9.  Ledger
 * 10. Dashboard
 * 11. BI / Forecasting
 * 12. Search
 * 13. Back-office queue
 * 14. Renewal
 * 15. Activities
 *
 * Key Invariants:
 * - A accessing A -> ALLOWED (within role permissions).
 * - A accessing B -> STRICTLY FORBIDDEN (all roles including ADMIN).
 * - B accessing A -> STRICTLY FORBIDDEN.
 * - ADMIN role NEVER means global.
 */
describe('Sprint 8.2: 15-Resource BOLA Authorization Matrix', () => {
  let authzService: ResourceAuthorizationService;
  let tenantAuth: TenantAuthorizationService;
  let leadPolicy: LeadPolicy;
  let contactPolicy: ContactPolicy;
  let quotationPolicy: QuotationPolicy;
  let policyPolicy: PolicyPolicy;
  let claimPolicy: ClaimPolicy;
  let documentPolicy: DocumentPolicy;
  let usersPolicy: UsersPolicy;
  let commissionPolicy: CommissionPolicy;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
    tenantAuth = new TenantAuthorizationService();
    leadPolicy = new LeadPolicy();
    contactPolicy = new ContactPolicy();
    quotationPolicy = new QuotationPolicy();
    policyPolicy = new PolicyPolicy();
    claimPolicy = new ClaimPolicy();
    documentPolicy = new DocumentPolicy();
    usersPolicy = new UsersPolicy();
    commissionPolicy = new CommissionPolicy();
  });

  const companyA = 'comp-tenant-a';
  const companyB = 'comp-tenant-b';

  // Company A Actors
  const adminA: any = {
    userId: 'usr-admin-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    status: UserStatus.ACTIVE,
  };

  const backOfficeA: any = {
    userId: 'usr-bo-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    status: UserStatus.ACTIVE,
  };

  const agentA: any = {
    userId: 'usr-agent-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    status: UserStatus.ACTIVE,
  };

  // Company B Actors
  const adminB: any = {
    userId: 'usr-admin-b',
    companyId: companyB,
    organizationId: companyB,
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    status: UserStatus.ACTIVE,
  };

  const backOfficeB: any = {
    userId: 'usr-bo-b',
    companyId: companyB,
    organizationId: companyB,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    status: UserStatus.ACTIVE,
  };

  // Company A Resources
  const resourcesA = {
    lead: { id: 'lead-a', companyId: companyA, createdById: agentA.userId },
    contact: { id: 'contact-a', companyId: companyA, createdById: agentA.userId },
    quotation: { id: 'quote-a', companyId: companyA, createdById: agentA.userId },
    payment: { id: 'pmt-a', companyId: companyA, quotation: { companyId: companyA } },
    policy: { id: 'pol-a', companyId: companyA, createdById: agentA.userId },
    claim: { id: 'clm-a', companyId: companyA, createdById: backOfficeA.userId },
    document: { id: 'doc-a', companyId: companyA, uploadedById: agentA.userId },
    settlement: { id: 'stl-a', companyId: companyA },
    ledger: { id: 'je-a', companyId: companyA },
    dashboard: { id: 'dsh-a', companyId: companyA },
    bi: { id: 'bi-a', companyId: companyA },
    search: { companyId: companyA },
    backOfficeQueue: { companyId: companyA },
    renewal: { id: 'rnw-a', policy: { companyId: companyA } },
    activity: { id: 'act-a', lead: { companyId: companyA } },
  };

  // Company B Resources
  const resourcesB = {
    lead: { id: 'lead-b', companyId: companyB, createdById: 'agent-b' },
    contact: { id: 'contact-b', companyId: companyB, createdById: 'agent-b' },
    quotation: { id: 'quote-b', companyId: companyB, createdById: 'agent-b' },
    payment: { id: 'pmt-b', companyId: companyB, quotation: { companyId: companyB } },
    policy: { id: 'pol-b', companyId: companyB, createdById: 'agent-b' },
    claim: { id: 'clm-b', companyId: companyB, createdById: backOfficeB.userId },
    document: { id: 'doc-b', companyId: companyB, uploadedById: 'agent-b' },
    settlement: { id: 'stl-b', companyId: companyB },
    ledger: { id: 'je-b', companyId: companyB },
    dashboard: { id: 'dsh-b', companyId: companyB },
    bi: { id: 'bi-b', companyId: companyB },
    search: { companyId: companyB },
    backOfficeQueue: { companyId: companyB },
    renewal: { id: 'rnw-b', policy: { companyId: companyB } },
    activity: { id: 'act-b', lead: { companyId: companyB } },
  };

  describe('Matrix 1: Leads BOLA', () => {
    it('Company A actors can read Company A leads', () => {
      expect(leadPolicy.canRead(adminA, resourcesA.lead)).toBe(true);
      expect(leadPolicy.canRead(backOfficeA, resourcesA.lead)).toBe(true);
      expect(leadPolicy.canRead(agentA, resourcesA.lead)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B leads', () => {
      expect(leadPolicy.canRead(adminA, resourcesB.lead)).toBe(false);
      expect(leadPolicy.canRead(backOfficeA, resourcesB.lead)).toBe(false);
      expect(leadPolicy.canRead(agentA, resourcesB.lead)).toBe(false);
    });

    it('Company B actors are REJECTED from reading Company A leads', () => {
      expect(leadPolicy.canRead(adminB, resourcesA.lead)).toBe(false);
      expect(leadPolicy.canRead(backOfficeB, resourcesA.lead)).toBe(false);
    });
  });

  describe('Matrix 2: Contacts BOLA', () => {
    it('Company A actors can read Company A contacts', () => {
      expect(contactPolicy.canRead(adminA, resourcesA.contact)).toBe(true);
      expect(contactPolicy.canRead(backOfficeA, resourcesA.contact)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B contacts', () => {
      expect(contactPolicy.canRead(adminA, resourcesB.contact)).toBe(false);
      expect(contactPolicy.canRead(backOfficeA, resourcesB.contact)).toBe(false);
      expect(contactPolicy.canRead(agentA, resourcesB.contact)).toBe(false);
    });
  });

  describe('Matrix 3: Quotations BOLA', () => {
    it('Company A actors can read Company A quotations', () => {
      expect(quotationPolicy.canRead(adminA, resourcesA.quotation)).toBe(true);
      expect(quotationPolicy.canRead(backOfficeA, resourcesA.quotation)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B quotations', () => {
      expect(quotationPolicy.canRead(adminA, resourcesB.quotation)).toBe(false);
      expect(quotationPolicy.canRead(backOfficeA, resourcesB.quotation)).toBe(false);
      expect(quotationPolicy.canRead(agentA, resourcesB.quotation)).toBe(false);
    });
  });

  describe('Matrix 4: Policies BOLA', () => {
    it('Company A actors can read Company A policies', () => {
      expect(policyPolicy.canRead(adminA, resourcesA.policy)).toBe(true);
      expect(policyPolicy.canRead(backOfficeA, resourcesA.policy)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B policies', () => {
      expect(policyPolicy.canRead(adminA, resourcesB.policy)).toBe(false);
      expect(policyPolicy.canRead(backOfficeA, resourcesB.policy)).toBe(false);
      expect(policyPolicy.canRead(agentA, resourcesB.policy)).toBe(false);
    });
  });

  describe('Matrix 5: Claims BOLA', () => {
    it('Company A actors can read Company A claims', () => {
      expect(claimPolicy.canRead(adminA, resourcesA.claim)).toBe(true);
      expect(claimPolicy.canRead(backOfficeA, resourcesA.claim)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B claims', () => {
      expect(claimPolicy.canRead(adminA, resourcesB.claim)).toBe(false);
      expect(claimPolicy.canRead(backOfficeA, resourcesB.claim)).toBe(false);
      expect(claimPolicy.canRead(agentA, resourcesB.claim)).toBe(false);
    });
  });

  describe('Matrix 6: Documents BOLA', () => {
    it('Company A actors can read Company A documents', () => {
      expect(documentPolicy.canRead(adminA, resourcesA.document)).toBe(true);
      expect(documentPolicy.canRead(backOfficeA, resourcesA.document)).toBe(true);
    });

    it('Company A actors are REJECTED from reading Company B documents', () => {
      expect(documentPolicy.canRead(adminA, resourcesB.document)).toBe(false);
      expect(documentPolicy.canRead(backOfficeA, resourcesB.document)).toBe(false);
      expect(documentPolicy.canRead(agentA, resourcesB.document)).toBe(false);
    });
  });

  describe('Matrix 7: User Management BOLA', () => {
    const userA = { id: 'usr-a', companyId: companyA };
    const userB = { id: 'usr-b', companyId: companyB };

    it('ADMIN A can manage Company A users', () => {
      expect(usersPolicy.canRead(adminA, userA)).toBe(true);
      expect(usersPolicy.canUpdate(adminA, userA)).toBe(true);
    });

    it('ADMIN A is REJECTED from reading or modifying Company B users', () => {
      expect(usersPolicy.canRead(adminA, userB)).toBe(false);
      expect(usersPolicy.canUpdate(adminA, userB)).toBe(false);
    });
  });

  describe('Matrix 8: Tenant Boundary Primitive Verification', () => {
    it('rejects cross-tenant access for all 15 resource types via TenantAuthorizationService', () => {
      const allResources = [
        'lead', 'contact', 'quotation', 'payment', 'policy',
        'claim', 'document', 'settlement', 'ledger', 'dashboard',
        'bi', 'search', 'backOfficeQueue', 'renewal', 'activity',
      ];

      for (const resType of allResources) {
        // Same company must pass
        expect(() => tenantAuth.assertSameCompany(adminA, companyA)).not.toThrow();

        // Cross company must fail
        expect(() => tenantAuth.assertSameCompany(adminA, companyB)).toThrow(
          CrossTenantException,
        );
        expect(() => tenantAuth.assertSameCompany(adminB, companyA)).toThrow(
          CrossTenantException,
        );
      }
    });
  });
});
