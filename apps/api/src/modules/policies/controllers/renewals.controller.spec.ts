import { NotFoundException } from '@nestjs/common';
import { RenewalsController } from './renewals.controller';

describe('RenewalsController', () => {
  let controller: RenewalsController;
  let prisma: any;
  let scopeResolver: any;
  let numberingEngine: any;
  let renewalEngine: any;
  let motorCalculationService: any;

  const mockUser: any = {
    id: 'user-1',
    companyId: 'company-1',
    role: 'BACK_OFFICE',
  };

  beforeEach(() => {
    prisma = {
      policy: {
        findFirst: jest.fn(),
      },
      renewalTask: {
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    scopeResolver = {
      resolveScopeFilter: jest.fn().mockReturnValue({}),
    };

    numberingEngine = {
      generateNext: jest.fn().mockResolvedValue('REN-001'),
    };

    renewalEngine = {
      calculateNextNCBSlab: jest.fn((ncb) => (ncb < 20 ? 20 : ncb + 5)),
      calculateRevisedIdv: jest.fn((idv, age) => {
        if (age > 5) {
          throw new Error('Vehicles older than five years require a mutually agreed IDV; statutory depreciation cannot determine the renewal IDV automatically.');
        }
        return { revisedIdv: Math.round(idv * 0.85), depreciationPercentage: 15 };
      }),
    };

    motorCalculationService = {
      calculate: jest.fn(),
    };

    controller = new RenewalsController(
      prisma,
      scopeResolver,
      numberingEngine,
      renewalEngine,
      motorCalculationService,
    );
  });

  describe('getRenewalQuotePrefill', () => {
    it('returns prefill data with statutory IDV depreciation for vehicles <= 5 years', async () => {
      const mockPolicy = {
        id: 'pol-1',
        policyNumber: 'POL-2024-001',
        actualPolicyNumber: '366003312619050875',
        contactId: 'cont-1',
        companyId: 'company-1',
        expiryDate: new Date('2026-12-01'),
        policyType: 'PACKAGE',
        contact: { firstName: 'Sanjay', lastName: 'Chougala', email: 's@test.com', phone: '9740937566' },
        customer: null,
        vehicle: {
          id: 'veh-1',
          registrationNumber: 'KA23EB8759',
          category: 'PRIVATE_CAR',
          dateOfRegistration: new Date('2024-01-15'), // ~2 years old
        },
        quotation: {
          sumInsured: 500000,
          ncbPercentage: 20,
          insurerName: 'HDFC ERGO',
          insurerId: 'ins-1',
        },
        insurerDetail: null,
        endorsements: [],
        claims: [],
      };

      prisma.policy.findFirst.mockResolvedValue(mockPolicy);

      const result = await controller.getRenewalQuotePrefill('pol-1', mockUser);

      expect(result.success).toBe(true);
      expect(result.prefill.policyId).toBe('pol-1');
      expect(result.prefill.pricing.suggestedIdv).toBe(425000);
      expect(result.prefill.pricing.depreciationPercentage).toBe(15);
      expect(result.prefill.vehicle.registrationNumber).toBe('KA23EB8759');
    });

    it('gracefully handles vehicles older than 5 years without throwing 400 error', async () => {
      const mockOldPolicy = {
        id: 'pol-old',
        policyNumber: 'POL-2018-001',
        actualPolicyNumber: '366001112619050111',
        contactId: 'cont-1',
        companyId: 'company-1',
        expiryDate: new Date('2026-11-15'),
        policyType: 'PACKAGE',
        contact: { firstName: 'Prashant', lastName: 'Mathapati', email: 'p@test.com', phone: '9740937566' },
        customer: null,
        vehicle: {
          id: 'veh-old',
          registrationNumber: 'MH31CS8604',
          category: 'PRIVATE_CAR',
          dateOfRegistration: new Date('2018-03-20'), // 8 years old
        },
        quotation: {
          sumInsured: 300000,
          ncbPercentage: 35,
          insurerName: 'United India Insurance',
          insurerId: 'ins-2',
        },
        insurerDetail: null,
        endorsements: [],
        claims: [],
      };

      prisma.policy.findFirst.mockResolvedValue(mockOldPolicy);

      const result = await controller.getRenewalQuotePrefill('pol-old', mockUser);

      expect(result.success).toBe(true);
      expect(result.prefill.policyId).toBe('pol-old');
      // Should prefill mutually agreed IDV (10% reduction = 270,000) instead of throwing
      expect(result.prefill.pricing.suggestedIdv).toBe(270000);
      expect(result.prefill.pricing.depreciationPercentage).toBe(10);
      expect(result.prefill.warnings.some((w: string) => w.includes('older than 5 years'))).toBe(true);
    });

    it('throws NotFoundException when policy does not exist', async () => {
      prisma.policy.findFirst.mockResolvedValue(null);

      await expect(controller.getRenewalQuotePrefill('non-existent', mockUser)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
