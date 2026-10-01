import { Test, TestingModule } from '@nestjs/testing';
import { Customer360Service } from './customer-360.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../../platform/cache/cache.provider';
import { ResourceAuthorizationService } from '../../../../../common/services/resource-authorization.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ActorContext } from '../../../../../common/interfaces/actor-context.interface';

describe('Customer360Service (Wave 7 Tenancy & PII Protection)', () => {
  let service: Customer360Service;
  let prisma: any;

  const mockAdminActor: ActorContext = {
    userId: 'admin-1',
    email: 'admin@company-a.com',
    firstName: 'Admin',
    lastName: 'User',
    organizationId: 'company-a',
    companyId: 'company-a',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    permissions: ['*'],
    workspaces: ['ADMIN'],
    status: UserStatus.ACTIVE,
  };

  const mockAgentActor: ActorContext = {
    userId: 'agent-1',
    email: 'agent@company-a.com',
    firstName: 'Agent',
    lastName: 'Smith',
    organizationId: 'company-a',
    companyId: 'company-a',
    agentId: 'ag-profile-1',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: ['CUSTOMER_READ'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
  };

  const mockTenantBActor: ActorContext = {
    userId: 'user-b',
    email: 'user@company-b.com',
    firstName: 'Tenant',
    lastName: 'B',
    organizationId: 'company-b',
    companyId: 'company-b',
    role: RoleType.ADMIN,
    roles: [RoleType.ADMIN],
    permissions: ['CUSTOMER_READ', 'REPORT_VIEW'],
    workspaces: ['ADMIN'],
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    prisma = {
      contact: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      agent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'ag-profile-1', userId: 'agent-1' }),
      },
      policy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      quotation: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      claim: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      communicationLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      document: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Customer360Service,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CACHE_PROVIDER_TOKEN,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn().mockResolvedValue(undefined),
            clear: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: ResourceAuthorizationService,
          useValue: new ResourceAuthorizationService(),
        },
      ],
    }).compile();

    service = module.get<Customer360Service>(Customer360Service);
  });

  describe('getCustomer360', () => {
    it('should throw NotFoundException if customer does not exist in tenant', async () => {
      prisma.contact.findFirst.mockResolvedValue(null);

      await expect(
        service.getCustomer360('non-existent', mockAdminActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('should aggregate real policies, quotations, claims, vehicles, and financial metrics', async () => {
      const mockContact = {
        id: 'contact-1',
        firstName: 'Rahul',
        lastName: 'Verma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '123456789012',
        companyId: 'company-a',
        createdById: 'admin-1',
        familyMembers: [],
      };

      const mockPolicies = [
        {
          id: 'pol-1',
          policyNumber: 'POL-1001',
          status: 'ACTIVE',
          premiumAmount: 18500,
          motorMetadata: {
            registrationNumber: 'MH12AB1234',
            make: 'Hyundai',
            model: 'Creta',
          },
          createdAt: new Date('2026-01-15'),
        },
      ];

      const mockQuotations = [
        {
          id: 'q-1',
          quotationCode: 'QTN-5001',
          totalPremium: 12000,
          status: 'DRAFT',
          registrationNumber: 'MH14CD5678',
          createdAt: new Date('2026-02-01'),
        },
      ];

      const mockClaims = [
        {
          id: 'cl-1',
          claimNumber: 'CLM-9001',
          claimAmount: 25000,
          status: 'UNDER_INVESTIGATION',
          createdAt: new Date('2026-03-01'),
        },
      ];

      prisma.contact.findFirst.mockResolvedValue(mockContact);
      prisma.policy.findMany.mockResolvedValue(mockPolicies);
      prisma.quotation.findMany.mockResolvedValue(mockQuotations);
      prisma.claim.findMany.mockResolvedValue(mockClaims);

      const result = await service.getCustomer360('contact-1', mockAdminActor);

      expect(result.profile.name).toBe('Rahul Verma');
      expect(result.analytics.totalPremiumPaid).toBe(18500);
      expect(result.analytics.activePoliciesCount).toBe(1);
      expect(result.analytics.openClaimsCount).toBe(1);
      expect(result.vehicles).toHaveLength(2);
      expect(result.timeline.length).toBeGreaterThanOrEqual(3);
    });

    it('should throw ForbiddenException if actor from Tenant B attempts cross-tenant access to Tenant A contact', async () => {
      const mockContact = {
        id: 'contact-tenant-a',
        firstName: 'Alice',
        lastName: 'Wonderland',
        companyId: 'company-a',
        createdById: 'admin-1',
        familyMembers: [],
      };

      prisma.contact.findFirst.mockResolvedValue(mockContact);

      // Tenant B actor attempts access
      await expect(
        service.getCustomer360('contact-tenant-a', mockTenantBActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if Agent attempts to access a customer they did not create and are not assigned to', async () => {
      const mockContact = {
        id: 'contact-unassigned',
        firstName: 'Bob',
        lastName: 'Builder',
        companyId: 'company-a',
        createdById: 'other-user',
        assignedToId: 'other-agent',
        familyMembers: [],
      };

      prisma.contact.findFirst.mockResolvedValue(mockContact);

      await expect(
        service.getCustomer360('contact-unassigned', mockAgentActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should mask PAN and Aadhaar for AGENT role without unmask permissions', async () => {
      const mockContact = {
        id: 'contact-assigned-agent',
        firstName: 'Charlie',
        lastName: 'Chaplin',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '998877665544',
        companyId: 'company-a',
        createdById: 'agent-1', // Agent is creator
        familyMembers: [],
      };

      prisma.contact.findFirst.mockResolvedValue(mockContact);

      const result = await service.getCustomer360('contact-assigned-agent', mockAgentActor);

      // Verification: PAN must be masked: XXXXX1234F
      expect(result.profile.panNumber).toBe('XXXXX1234F');
      // Verification: Aadhaar must be masked: XXXX-XXXX-5544
      expect(result.profile.aadhaarNumber).toBe('XXXX-XXXX-5544');
    });

    it('should provide unmasked PAN and Aadhaar for authorized ADMIN role', async () => {
      const mockContact = {
        id: 'contact-admin-view',
        firstName: 'Diana',
        lastName: 'Prince',
        panNumber: 'ABCDE1234F',
        aadhaarNumber: '998877665544',
        companyId: 'company-a',
        createdById: 'admin-1',
        familyMembers: [],
      };

      prisma.contact.findFirst.mockResolvedValue(mockContact);

      const result = await service.getCustomer360('contact-admin-view', mockAdminActor);

      expect(result.profile.panNumber).toBe('ABCDE1234F');
      expect(result.profile.aadhaarNumber).toBe('998877665544');
    });
  });
});

