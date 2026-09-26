import { Test, TestingModule } from '@nestjs/testing';
import { MotorCalculationService } from './motor-calculation.service';
import { MotorTariffService } from './motor-tariff.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

import { MotorPolicyDateService } from './motor-policy-date.service';

describe('MotorCalculationService (Iteration 5 Financial Math)', () => {
  let service: MotorCalculationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorCalculationService,
        MotorPolicyDateService,
        {
          provide: PrismaService,
          useValue: {
            systemConfig: {
              findFirst: jest.fn().mockResolvedValue(null),
            },
          },
        },
        {
          provide: MotorTariffService,
          useValue: {
            lookupTpTariff: jest.fn().mockResolvedValue({
              found: true,
              annualPremium: 3416,
              tariffId: 'tariff-pc-2026',
              isVerified: true,
            }),
          },
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

      // Gross Base Premium = Base OD (15635) + Base TP (3416) + PA (275) = 19326
      expect(outputs.grossBasePremium).toBe(19326);

      // Net Customer Premium = Net OD (11257.2) + Net TP (3691) = 14948.2
      expect(outputs.netCustomerPremium).toBe(14948.2);
      expect(outputs.basePremium).toBe(14948.2);

      // Component-level 18% GST (per v4.2 spec: tax applied on net discounted component):
      // GST on OD (11257.2 * 0.18) = 2026.3
      // GST on TP (3416 * 0.18) = 614.88
      // GST on PA (275 * 0.18) = 49.5
      // Total GST = 2690.68
      expect(outputs.totalGst).toBe(2690.68);

      // Final Payable = Net Customer Premium (14948.2) + GST (2690.68) = 17638.88
      expect(outputs.totalPremium).toBe(17638.88);
      expect(outputs.finalPayableAmount).toBe(17638.88);

      // Verify that base premium is strictly different from total payable
      expect(outputs.basePremium).not.toBe(outputs.totalPremium);
    });

    it('should reject discount exceeding absolute ceiling (50%)', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          discountPercent: 55,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject discount exceeding standard authority (20%) without approvalReference', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          discountPercent: 25,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow discount exceeding standard authority (20%) with valid approvalReference', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        discountPercent: 25,
        approvalReference: 'APP-REF-12345',
      });
      expect(result.outputs.specialDiscount).toBeGreaterThan(0);
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
          addons: [{ addonCode: 'UNKNOWN_CUSTOM_ADDON' }],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('MOTOR-REG-03: should reject SAOD for NEW vehicles with HTTP 400', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'NEW',
          policyType: 'STANDALONE_OD',
          idv: 500000,
          activeTpPolicyNumber: 'TP-12345',
          activeTpExpiryDate: '2028-12-31',
        }),
      ).rejects.toThrow('Standalone OD is not applicable for new vehicles');
    });

    it('MOTOR-REG-04: should force NCB to 0% for NEW vehicles even if higher percentage requested', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'NEW',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 50,
      });

      expect(result.inputs.effectiveNcb).toBe(0);
      expect(result.outputs.ncbDiscount).toBe(0);
    });

    it('MOTOR-REG-05: should calculate TP discount and apply GST to net TP correctly', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'THIRD_PARTY_ONLY',
        tpDiscountPercent: 10,
        paCover: false,
      });

      // Base TP = 3416. 10% discount = 341.6. Net TP = 3074.4
      expect(result.outputs.baseTpPremium).toBe(3416);
      expect(result.outputs.netTpComponent).toBe(3074.4);
      // GST on net TP: 3074.4 * 0.18 = 553.39
      expect(result.outputs.gstOnTp).toBe(553.39);
      expect(result.outputs.totalPremium).toBe(3627.79);
    });

    it('MOTOR-REG-06: should enforce TP discount authority limit', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          tpDiscountPercent: 25, // exceeds standard 15% without approvalReference
          paCover: false,
        }),
      ).rejects.toThrow('exceeds the configured standard authority limit');
    });

    it('MOTOR-REG-17: should return authoritative policy dates', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'NEW',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
      });

      expect(result.authoritativeDates).toBeDefined();
      expect(result.authoritativeDates.odStartDate).toBeDefined();
      expect(result.authoritativeDates.odEndDate).toBeDefined();
      expect(result.authoritativeDates.tpStartDate).toBeDefined();
      expect(result.authoritativeDates.tpEndDate).toBeDefined();
      expect(result.authoritativeDates.effectiveStartDate).toBeDefined();
      expect(result.authoritativeDates.effectiveEndDate).toBeDefined();
    });
  });
});
