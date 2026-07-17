import { Test, TestingModule } from '@nestjs/testing';
import { RatingEngineService } from '../services/rating-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { RatingRuleType } from '@prisma/client';

describe('RatingEngineService', () => {
  let service: RatingEngineService;
  let prisma: PrismaService;

  const mockVariant = {
    id: 'var-123',
    name: 'Alpha Petrol Manual',
    code: 'SWIFT_ALPHA_P_M',
    engineCapacity: 1197,
    exShowroomPrice: 800000,
    model: {
      id: 'mod-123',
      name: 'Swift',
      manufacturer: { id: 'mfg-123', name: 'Maruti Suzuki' },
    },
  };

  const mockRules = [
    {
      id: 'rule-1',
      ruleName: 'Base Rate 3%',
      ruleType: RatingRuleType.BASE_RATE,
      formulaOrRate: { rate: 0.03 },
      priority: 10,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingEngineService,
        {
          provide: PrismaService,
          useValue: {
            vehicleVariant: {
              findUnique: jest.fn().mockResolvedValue(mockVariant),
            },
            ratingRule: {
              findMany: jest.fn().mockResolvedValue(mockRules),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RatingEngineService>(RatingEngineService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('calculatePremium', () => {
    it('should calculate premium correctly for brand new car with base rate rule', async () => {
      const result = await service.calculatePremium({
        variantId: 'var-123',
        insurerId: 'ins-123',
        productId: 'prod-123',
        vehicleAgeYears: 0,
        ncbPercentage: 0,
      });

      expect(result.idv).toBe(760000);
      expect(result.calculations.ownDamage.base).toBe(22800);
      expect(result.calculations.thirdParty).toBe(3416);
      expect(result.calculations.netPremium).toBe(26216);
      expect(result.calculations.gst).toBe(4719);
      expect(result.calculations.totalPremium).toBe(30935);
    });

    it('should calculate premium with NCB discount correctly', async () => {
      const result = await service.calculatePremium({
        variantId: 'var-123',
        insurerId: 'ins-123',
        productId: 'prod-123',
        vehicleAgeYears: 1,
        ncbPercentage: 20,
      });

      expect(result.idv).toBe(680000);
      expect(result.calculations.ownDamage.base).toBe(20400);
      expect(result.calculations.ownDamage.ncbDiscount).toBe(4080);
      expect(result.calculations.ownDamage.final).toBe(16320);
    });
  });
});
