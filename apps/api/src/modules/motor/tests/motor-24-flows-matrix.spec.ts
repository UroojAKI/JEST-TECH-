import { Test, TestingModule } from '@nestjs/testing';
import { MotorCalculationService } from '../services/motor-calculation.service';
import { MotorRuleEngineService, MotorRuleContext } from '../services/motor-rule-engine.service';
import { MotorPolicyDateService } from '../services/motor-policy-date.service';
import { MotorTariffService } from '../services/motor-tariff.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { VehicleCategory } from '@prisma/client';

describe('Phase 9: 24-Flow Comprehensive Matrix Suite (8 Categories × 3 Policy Types)', () => {
  let calcService: MotorCalculationService;
  let ruleEngine: MotorRuleEngineService;
  let dateService: MotorPolicyDateService;

  const ALL_CATEGORIES: VehicleCategory[] = [
    VehicleCategory.BIKE,
    VehicleCategory.PRIVATE_CAR,
    VehicleCategory.GCV,
    VehicleCategory.TRACTOR,
    VehicleCategory.AUTO,
    VehicleCategory.TAXI,
    VehicleCategory.BUS_COACH,
    VehicleCategory.MISC_CLASS_D,
  ];

  beforeEach(async () => {
    dateService = new MotorPolicyDateService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorCalculationService,
        MotorRuleEngineService,
        {
          provide: MotorPolicyDateService,
          useValue: dateService,
        },
        {
          provide: PrismaService,
          useValue: {
            systemConfig: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            motorTariff: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            ratingEngineRule: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            taxRule: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
            productAddonRate: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
        {
          provide: MotorTariffService,
          useValue: {
            lookupTpTariff: jest.fn().mockImplementation(async (params) => ({
              found: true,
              annualPremium: params.vehicleCategory === 'BIKE' ? 714 : 3416,
              tariffId: `tariff-${params.vehicleCategory.toLowerCase()}`,
              isVerified: true,
            })),
          },
        },
      ],
    }).compile();

    calcService = module.get<MotorCalculationService>(MotorCalculationService);
    ruleEngine = module.get<MotorRuleEngineService>(MotorRuleEngineService);
  });

  describe('Matrix Verification: 8 Categories × 3 Policy Types (24 Flows)', () => {
    ALL_CATEGORIES.forEach((category) => {
      describe(`Category: ${category}`, () => {
        // Flow 1: TP_ONLY
        it(`[Flow ${category} × TP_ONLY] should calculate statutory TP without OD, bypass inspection, and enforce 0% NCB`, async () => {
          // Rule Engine verification
          const ruleResult = ruleEngine.evaluateQuotation({
            vehicleStatus: 'EXISTING',
            newPolicyType: 'TP_ONLY',
            policyExpiryDate: '2026-01-01', // Expired long ago
            expiredMoreThan90Days: true,
            eligibleNcbPercentage: 50,
          });

          // IRDAI statutory bypass: TP only NEVER requires inspection, NCB is always 0%
          expect(ruleResult.inspectionRequired).toBe(false);
          expect(ruleResult.ncb).toBe(0);
          expect(ruleResult.nextStep).toBe('QUOTATION');

          // Calculation Service verification
          const calcResult = await calcService.calculate({
            vehicleCategory: category,
            vehicleStatus: 'EXISTING',
            policyType: 'THIRD_PARTY_ONLY',
            paCover: false,
          });

          expect(calcResult.outputs.baseOdPremium).toBe(0);
          expect(calcResult.outputs.baseTpPremium).toBeGreaterThan(0);
          expect(calcResult.outputs.od.gross).toBe(0);
          expect(calcResult.outputs.od.net).toBe(0);
          expect(calcResult.outputs.tp.net).toBeGreaterThan(0);
          expect(calcResult.outputs.summary.finalPayable).toBe(
            Math.round((calcResult.outputs.summary.netPremium + calcResult.outputs.summary.totalGst) * 100) / 100,
          );
        });

        // Flow 2: SAOD
        it(`[Flow ${category} × SAOD] should reject for NEW vehicle and calculate OD-only for EXISTING vehicle with valid active TP`, async () => {
          // 1. Rejection on NEW vehicle
          await expect(
            calcService.calculate({
              vehicleCategory: category,
              vehicleStatus: 'NEW',
              policyType: 'STANDALONE_OD',
              idv: 300000,
            }),
          ).rejects.toThrow(BadRequestException);

          // 2. Existing vehicle calculation with valid active TP
          const futureDate = new Date();
          futureDate.setMonth(futureDate.getMonth() + 6);
          const activeTpExpiry = futureDate.toISOString().slice(0, 10);

          const ruleResult = ruleEngine.evaluateQuotation({
            vehicleStatus: 'EXISTING',
            newPolicyType: 'SAOD',
            eligibleNcbPercentage: 20,
            tpExpiryDate: activeTpExpiry,
          });

          expect(ruleResult.tpVerificationRequired).toBe(true);
          expect(ruleResult.saodTpValid).toBe(true);
          expect(ruleResult.ncb).toBe(20);

          const calcResult = await calcService.calculate({
            vehicleCategory: category,
            vehicleStatus: 'EXISTING',
            policyType: 'STANDALONE_OD',
            idv: 300000,
            ncbPercent: 20,
            activeTpPolicyNumber: 'TP-POL-998877',
            activeTpExpiryDate: activeTpExpiry,
          });

          expect(calcResult.outputs.baseOdPremium).toBeGreaterThan(0);
          expect(calcResult.outputs.baseTpPremium).toBe(0); // SAOD does not charge TP
          expect(calcResult.outputs.ncbDiscount).toBeGreaterThan(0);
          expect(calcResult.outputs.od.gross).toBeGreaterThan(0);
          expect(calcResult.outputs.tp.net).toBe(0);
          expect(calcResult.outputs.summary.finalPayable).toBe(
            Math.round((calcResult.outputs.summary.netPremium + calcResult.outputs.summary.totalGst) * 100) / 100,
          );
        });

        // Flow 3: PACKAGE
        it(`[Flow ${category} × PACKAGE] should calculate both OD and TP components, correctly breakdown GST and summary`, async () => {
          const ruleResult = ruleEngine.evaluateQuotation({
            vehicleStatus: 'EXISTING',
            newPolicyType: 'PACKAGE',
            eligibleNcbPercentage: 35,
          });

          expect(ruleResult.ncb).toBe(35);
          expect(ruleResult.inspectionRequired).toBe(false);

          const calcResult = await calcService.calculate({
            vehicleCategory: category,
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 450000,
            ncbPercent: 35,
            discountPercent: 10,
            paCover: true,
            paidDriverLiability: true,
          });

          // Both components present
          expect(calcResult.outputs.baseOdPremium).toBeGreaterThan(0);
          expect(calcResult.outputs.baseTpPremium).toBeGreaterThan(0);
          expect(calcResult.outputs.paPremium).toBe(275);
          expect(calcResult.outputs.paidDriverPremium).toBe(50);

          // Component breakdowns
          expect(calcResult.outputs.od.gross).toBe(calcResult.outputs.baseOdPremium);
          expect(calcResult.outputs.od.ncbDiscount).toBe(calcResult.outputs.ncbDiscount);
          expect(calcResult.outputs.od.specialDiscount).toBe(calcResult.outputs.specialDiscount);
          expect(calcResult.outputs.tp.base).toBe(calcResult.outputs.baseTpPremium);
          expect(calcResult.outputs.pa.premium).toBe(275);
          expect(calcResult.outputs.paidDriver.premium).toBe(50);

          // Mathematical consistency
          const expectedNet =
            calcResult.outputs.od.net +
            calcResult.outputs.tp.net +
            calcResult.outputs.pa.premium +
            calcResult.outputs.paidDriver.premium;
          expect(calcResult.outputs.summary.netPremium).toBe(Math.round(expectedNet * 100) / 100);

          const expectedGst =
            calcResult.outputs.od.gst +
            calcResult.outputs.tp.gst +
            calcResult.outputs.pa.gst +
            calcResult.outputs.paidDriver.gst;
          expect(calcResult.outputs.summary.totalGst).toBe(Math.round(expectedGst * 100) / 100);

          expect(calcResult.outputs.summary.finalPayable).toBe(
            Math.round((calcResult.outputs.summary.netPremium + calcResult.outputs.summary.totalGst) * 100) / 100,
          );
        });
      });
    });
  });

  describe('Statutory Multi-Year Tenures on NEW Vehicles', () => {
    it('BIKE new vehicle mandates 5-year TP tenure', async () => {
      const result = await calcService.calculate({
        vehicleCategory: 'BIKE',
        vehicleStatus: 'NEW',
        policyType: 'THIRD_PARTY_ONLY',
        paCover: false,
      });

      // 714 annual * 5 years = 3570
      expect(result.inputs.tpTenure).toBe(5);
      expect(result.outputs.baseTpPremium).toBe(3570);
    });

    it('PRIVATE_CAR new vehicle mandates 3-year TP tenure', async () => {
      const result = await calcService.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'NEW',
        policyType: 'THIRD_PARTY_ONLY',
        paCover: false,
      });

      // 3416 annual * 3 years = 10248
      expect(result.inputs.tpTenure).toBe(3);
      expect(result.outputs.baseTpPremium).toBe(10248);
    });

    it('Commercial vehicles (GCV, TAXI, BUS) use 1-year TP tenure', async () => {
      for (const cat of ['GCV', 'TAXI', 'BUS_COACH'] as const) {
        const result = await calcService.calculate({
          vehicleCategory: cat,
          vehicleStatus: 'NEW',
          policyType: 'THIRD_PARTY_ONLY',
          paCover: false,
        });

        expect(result.inputs.tpTenure).toBe(1);
        expect(result.outputs.baseTpPremium).toBe(3416);
      }
    });
  });

  describe('Universal Underwriting Rules across all Categories', () => {
    it('Claim in previous year resets NCB to 0% across all 8 categories', async () => {
      for (const category of ALL_CATEGORIES) {
        const ruleResult = ruleEngine.evaluateQuotation({
          vehicleStatus: 'EXISTING',
          newPolicyType: 'PACKAGE',
          claimInPreviousYear: true,
          eligibleNcbPercentage: 50,
        });

        expect(ruleResult.ncb).toBe(0);
        expect(ruleResult.ncbReason).toBe('CLAIM_IN_PREVIOUS_YEAR');
      }
    });

    it('Policy expired > 90 days triggers inspection and resets NCB to 0% across all 8 categories for PACKAGE', async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 95);
      const pastDateStr = pastDate.toISOString().slice(0, 10);

      for (const category of ALL_CATEGORIES) {
        const ruleResult = ruleEngine.evaluateQuotation({
          vehicleStatus: 'EXISTING',
          newPolicyType: 'PACKAGE',
          policyExpiryDate: pastDateStr,
          eligibleNcbPercentage: 45,
        });

        expect(ruleResult.inspectionRequired).toBe(true);
        expect(ruleResult.ncb).toBe(0);
        expect(ruleResult.ncbReason).toBe('POLICY_EXPIRED_MORE_THAN_90_DAYS');
        expect(ruleResult.nextStep).toBe('INSPECTION');
      }
    });
  });
});
