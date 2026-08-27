import { Test, TestingModule } from '@nestjs/testing';
import { MotorCalculationService } from './motor-calculation.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('MotorCalculationService (Iteration 5 Financial Math)', () => {
  let service: MotorCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorCalculationService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<MotorCalculationService>(MotorCalculationService);
  });

  describe('Comprehensive Private Car Calculation', () => {
    it('should correctly calculate OD, TP, NCB, Special Discount, GST, and Total Premium', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
        discountPercent: 10,
        paCover: true,
      });

      const { outputs } = result;

      // OD Base = 500000 * (3.127 / 100) = 15635
      expect(outputs.baseOdPremium).toBe(15635);

      // NCB 20% = 15635 * 0.20 = 3127
      expect(outputs.ncbDiscount).toBe(3127);

      // OD After NCB = 15635 - 3127 = 12508
      // Special Discount 10% = 12508 * 0.10 = 1250.8
      expect(outputs.specialDiscount).toBe(1250.8);

      // Net OD = 12508 - 1250.8 = 11257.2
      expect(outputs.netOdPremium).toBe(11257.2);

      // TP Base = 3416, PA Cover = 275 -> Net TP = 3691
      expect(outputs.baseTpPremium).toBe(3416);
      expect(outputs.paPremium).toBe(275);
      expect(outputs.netTpPremium).toBe(3691);

      // Pre-tax Base Premium = Net OD (11257.2) + Net TP (3691) = 14948.2
      expect(outputs.basePremium).toBe(14948.2);

      // GST 18% = 14948.2 * 0.18 = 2690.68
      expect(outputs.totalGst).toBe(2690.68);

      // Final Payable = 14948.2 + 2690.68 = 17638.88
      expect(outputs.totalPremium).toBe(17638.88);
      expect(outputs.finalPayableAmount).toBe(17638.88);

      // Verify that base premium is strictly different from total payable
      expect(outputs.basePremium).not.toBe(outputs.totalPremium);
    });

    it('should compute Add-ons correctly as percentage of IDV and fixed amounts', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 600000,
        ncbPercent: 0,
        discountPercent: 0,
        addons: [
          { addonCode: 'ZERO_DEP' }, // 0.9% of 600000 = 5400
          { addonCode: 'RSA' }, // Flat 499
        ],
        paCover: false,
      });

      const { outputs } = result;
      expect(outputs.addonPremium).toBe(5400 + 499);
      expect(outputs.itemizedAddons).toHaveLength(2);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('should reject Standalone OD without active TP policy details', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'STANDALONE_OD',
          idv: 400000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reset NCB to 0 if there was a claim in expiring policy', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 300000,
        ncbPercent: 50,
        claimInExpiringPolicy: true,
      });

      expect(result.inputs.effectiveNcb).toBe(0);
      expect(result.outputs.ncbDiscount).toBe(0);
    });

    it('should reject zero-premium addon selection per IRDAI compliance (G018)', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          addons: [
            { addonCode: 'UNKNOWN_CUSTOM_ADDON' },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
