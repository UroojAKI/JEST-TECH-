// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { RatingEngineService } from './rating-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { RatingRuleType, Prisma } from '@prisma/client';

describe('RatingEngineService', () => {
  let service: RatingEngineService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockPrismaService = {
    vehicleVariant: {
      findUnique: jest.fn(),
    },
    ratingRule: {
      findMany: jest.fn(),
    },
    systemConfig: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingEngineService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RatingEngineService>(RatingEngineService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  const baseVariant = {
    id: 'var-1',
    exShowroomPrice: '1000000',
    engineCapacity: 1000,
    model: { vehicleType: 'FOUR_WHEELER' },
  };

  const baseParams = {
    variantId: 'var-1',
    insurerId: 'ins-1',
    productId: 'prod-1',
    vehicleAgeYears: 0,
  };

  describe('calculatePremium', () => {
    it('Private car, engine <=1000cc, no NCB, no add-ons -> correct OD + TP + CPA = total', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null); // Force fallback TP & CPA

      const result = await service.calculatePremium({ ...baseParams, ncbPercentage: 0, selectedAddons: [] });

      // IDV = 1000000 * (1 - 0.05) = 950000
      // Base OD = 950000 * 0.025 = 23750
      // TP fallback for FOUR_WHEELER <= 1000 = 2094
      // CPA fallback = 788
      // Net = 23750 + 2094 + 788 = 26632
      // GST = 26632 * 0.18 = 4794
      // Total = 31426

      expect(result.idv).toBe(950000);
      expect(result.calculations.ownDamage.final).toBe(23750);
      expect(result.calculations.thirdParty).toBe(2094);
      expect(result.calculations.cpaPremium).toBe(788);
      expect(result.calculations.netPremium).toBe(26632);
      expect(result.calculations.totalPremium).toBe(31426);
    });

    it('Private car, 20% NCB -> OD discounted by 20%', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.calculatePremium({ ...baseParams, ncbPercentage: 20 });

      // OD base = 23750
      // NCB discount = 23750 * 0.20 = 4750
      // OD final = 23750 - 4750 = 19000

      expect(result.calculations.ownDamage.ncbDiscount).toBe(4750);
      expect(result.calculations.ownDamage.final).toBe(19000);
    });

    it('Private car, 50% NCB -> OD discounted by 50%, TP unchanged', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.calculatePremium({ ...baseParams, ncbPercentage: 50 });

      // OD base = 23750
      // NCB discount = 23750 * 0.50 = 11875
      // OD final = 23750 - 11875 = 11875

      expect(result.calculations.ownDamage.ncbDiscount).toBe(11875);
      expect(result.calculations.ownDamage.final).toBe(11875);
      expect(result.calculations.thirdParty).toBe(2094);
    });

    it('invalid NCB value (e.g. 15%) -> throws BadRequestException', async () => {
      await expect(
        service.calculatePremium({ ...baseParams, ncbPercentage: 15 })
      ).rejects.toThrow(BadRequestException);
    });

    it('vehicle age >5 years with manualIdv -> uses manual IDV, not formula', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.calculatePremium({ ...baseParams, vehicleAgeYears: 6, manualIdv: 400000 });

      expect(result.idv).toBe(400000);
      expect(result.calculations.ownDamage.base).toBe(10000); // 400000 * 0.025
    });

    it('vehicle age >5 years WITHOUT manualIdv -> throws BadRequestException', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);

      await expect(
        service.calculatePremium({ ...baseParams, vehicleAgeYears: 6 })
      ).rejects.toThrow(BadRequestException);
    });

    it('2-Wheeler <=75cc -> correct TP rate applied (₹538)', async () => {
      const twVariant = {
        ...baseVariant,
        engineCapacity: 75,
        model: { vehicleType: 'TWO_WHEELER' },
      };
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(twVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockImplementation(async (arg) => {
        if (arg.where.key === 'tp_rates') {
          return { value: JSON.stringify({ tw: { upto_75cc: 538 } }) };
        }
        return null;
      });

      const result = await service.calculatePremium({ ...baseParams, vehicleAgeYears: 0 });

      expect(result.calculations.thirdParty).toBe(538);
    });

    it('CPA waiver = true -> CPA premium NOT added', async () => {
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(baseVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      mockPrismaService.systemConfig.findUnique.mockResolvedValue(null);

      const result = await service.calculatePremium({ ...baseParams, isOwnerDriver: false });

      expect(result.calculations.cpaPremium).toBe(0);
    });

    it('DB lookup failure -> falls back to hardcoded rates gracefully', async () => {
      const twVariant = {
        ...baseVariant,
        engineCapacity: 100, // For 2w, generic fallback is 2099
        model: { vehicleType: 'TWO_WHEELER' },
      };
      mockPrismaService.vehicleVariant.findUnique.mockResolvedValue(twVariant as any);
      mockPrismaService.ratingRule.findMany.mockResolvedValue([]);
      // Return a rejected Promise (not a throw) so Jest's unhandledRejection
      // detector doesn't fire — the service's try/catch handles it internally.
      mockPrismaService.systemConfig.findUnique.mockImplementation((arg: any) => {
        if (arg?.where?.key === 'tp_rates') return Promise.reject(new Error('DB Error'));
        return Promise.resolve(null); // cpa_premium => hardcoded 788
      });

      const result = await service.calculatePremium({ ...baseParams, vehicleAgeYears: 0 });

      expect(result.calculations.thirdParty).toBe(2099); // generic TW fallback
      expect(result.calculations.cpaPremium).toBe(788);  // hardcoded CPA fallback
    });
  });

  describe('computeComprehensivePolicyMath — Arbitrary-Precision Financial Invariance (SDP Vol 3)', () => {
    it('MUST correctly calculate 3-Year statutory Private Car Third-Party mandatory premium and 18% GST without penny rounding drift', async () => {
      const quotePayload = {
        vehicleCategory: 'PRIVATE_CAR_3YR_MANDATORY_TP',
        cubicCapacity: 1197, // < 1500cc IRDAI slab
        exShowroomPrice: new Prisma.Decimal('745890.00'),
        depreciationPercentage: new Prisma.Decimal('20.00'), // Age 1-2 years
      };

      const calculationResult = service.computeComprehensivePolicyMath(quotePayload);

      // Assert exact Insured Declared Value (IDV) after statutory 20% depreciation: 745,890.00 * 0.80 = 596,712.00 exact
      expect(calculationResult.insuredDeclaredValue.toFixed(2)).toEqual('596712.00');

      // Assert exact segregation between OD and TP tax ledgers
      expect(calculationResult.ownDamageTaxGst.add(calculationResult.thirdPartyTaxGst).toFixed(2))
        .toEqual(calculationResult.totalTaxGst.toFixed(2));

      // Absolute financial invariance: Basic Net OD + Basic Net TP + Total GST MUST equal Net Payable Customer Premium
      const invariantTotal = calculationResult.netOwnDamagePremium
        .add(calculationResult.netThirdPartyPremium)
        .add(calculationResult.totalTaxGst);

      expect(calculationResult.netCustomerPayablePremium.toFixed(2)).toEqual(invariantTotal.toFixed(2));
    });
  });
});

