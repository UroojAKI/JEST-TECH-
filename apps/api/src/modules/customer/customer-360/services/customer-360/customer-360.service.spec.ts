import { Test, TestingModule } from '@nestjs/testing';
import { Customer360Service } from './customer-360.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../../platform/cache/cache.provider';
import { ResourceAuthorizationService } from '../../../../../common/services/resource-authorization.service';
import { NotFoundException } from '@nestjs/common';

describe('Customer360Service (Iteration 9 Real Aggregation)', () => {
  let service: Customer360Service;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      contact: {
        findUnique: jest.fn(),
      },
      policy: {
        findMany: jest.fn(),
      },
      quotation: {
        findMany: jest.fn(),
      },
      claim: {
        findMany: jest.fn(),
      },
      communicationLog: {
        findMany: jest.fn(),
      },
      lead: {
        findMany: jest.fn(),
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
    it('should throw NotFoundException if customer does not exist', async () => {
      prisma.contact.findUnique.mockResolvedValue(null);

      await expect(service.getCustomer360('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should aggregate real policies, quotations, claims, vehicles, and financial metrics', async () => {
      const mockContact = {
        id: 'contact-1',
        firstName: 'Rahul',
        lastName: 'Verma',
        email: 'rahul@example.com',
        phone: '+919876543210',
        panNumber: 'ABCDE1234F',
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

      prisma.contact.findUnique.mockResolvedValue(mockContact);
      prisma.policy.findMany.mockResolvedValue(mockPolicies);
      prisma.quotation.findMany.mockResolvedValue(mockQuotations);
      prisma.claim.findMany.mockResolvedValue(mockClaims);
      prisma.communicationLog.findMany.mockResolvedValue([]);
      prisma.lead.findMany.mockResolvedValue([]);

      const result = await service.getCustomer360('contact-1');

      expect(result.profile.name).toBe('Rahul Verma');
      expect(result.analytics.totalPremiumPaid).toBe(18500);
      expect(result.analytics.activePoliciesCount).toBe(1);
      expect(result.analytics.openClaimsCount).toBe(1);
      expect(result.vehicles).toHaveLength(2); // 1 from active policy, 1 from quotation
      expect(result.timeline.length).toBeGreaterThanOrEqual(3);
    });
  });
});
