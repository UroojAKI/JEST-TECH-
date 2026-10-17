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

      // NCB is underwriting metadata; monetary deduction is strictly 0
      expect(outputs.ncbDiscount).toBe(0);

      // Commercial discount is on Payable Base; special in-line discount is 0
      expect(outputs.specialDiscount).toBe(0);

      // Net OD preserved undiscounted
      expect(outputs.netOdPremium).toBe(15635);

      // TP Base = 3416, PA Cover = 275 -> Net TP = 3691
      expect(outputs.baseTpPremium).toBe(3416);
      expect(outputs.paPremium).toBe(275);
      expect(outputs.netTpPremium).toBe(3691);

      // Gross Base Premium = Base OD (15635) + Base TP (3416) + PA (275) = 19326
      expect(outputs.grossBasePremium).toBe(19326);
      expect(outputs.netCustomerPremium).toBe(19326);
      expect(outputs.basePremium).toBe(19326);

      // Component-level 18% GST (Mandatory rule: GST base = gross premium before discount):
      // GST on OD (15635 * 0.18) = 2814.3
      // GST on TP (3416 * 0.18) = 614.88
      // GST on PA (275 * 0.18) = 49.5
      // Total GST = 3478.68
      expect(outputs.totalGst).toBe(3478.68);

      // Payable Base = 19326 + 3478.68 = 22804.68
      expect(outputs.payableSummary.payableBase).toBe(22804.68);

      // Commercial discount: 10% on 22804.68 = 2280.47
      expect(outputs.payableSummary.commercialDiscount.amount).toBe(2280.47);
      expect(outputs.totalDiscount).toBe(2280.47);

      // Final Payable = Payable Base (22804.68) - Commercial Discount (2280.47) = 20524.21
      expect(outputs.totalPremium).toBe(20524.21);
      expect(outputs.finalPayableAmount).toBe(20524.21);

      // Underwriting Metadata
      expect(outputs.underwriting).toEqual({
        ncbPercentage: 20,
        ncbEligible: true,
        claimReported: false,
      });

      // Phase 4 Specification: Structured Component Breakdown
      expect(outputs.od).toEqual({
        gross: 15635,
        ncbDiscount: 0,
        specialDiscount: 0,
        addons: 0,
        net: 15635,
        gst: 2814.3,
        isEdited: false,
      });
      expect(outputs.tp).toEqual({
        base: 3416,
        discount: 0,
        net: 3416,
        gst: 614.88,
        isEdited: false,
      });
      expect(outputs.pa).toEqual({
        premium: 275,
        gst: 49.5,
        isEdited: false,
      });
      expect(outputs.summary).toEqual({
        grossPremium: 19326,
        totalDiscount: 2280.47,
        netPremium: 19326,
        totalGst: 3478.68,
        finalPayable: 20524.21,
        gstBreakdown: expect.objectContaining({
          base: 'GROSS',
          od: { base: 15635, rate: 0.18, amount: 2814.3 },
          tp: { base: 3416, rate: 0.18, amount: 614.88 },
          pa: { base: 275, rate: 0.18, amount: 49.5 },
        }),
      });

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
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBeGreaterThan(0);
      expect(result.outputs.commercialDiscountAmount).toBeGreaterThan(0);
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

    it('should flag zero-premium or invalid addon without crashing the quote calculation', async () => {
      const result = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        addons: [{ addonCode: 'UNKNOWN_CUSTOM_ADDON' }],
      });

      expect(result.outputs.itemizedAddons).toHaveLength(1);
      expect(result.outputs.itemizedAddons[0].isInvalid).toBe(true);
      expect(result.outputs.addonPremium).toBe(0);
      expect(result.outputs.baseOdPremium).toBeGreaterThan(0);
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

    it('MOTOR-REG-05: should calculate TP discount and apply GST to gross TP correctly', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'THIRD_PARTY_ONLY',
        tpDiscountPercent: 10,
        paCover: false,
      });

      // Base TP = 3416. Component is preserved undiscounted
      expect(result.outputs.baseTpPremium).toBe(3416);
      expect(result.outputs.netTpComponent).toBe(3416);
      // GST on gross TP (statutory rule): 3416 * 0.18 = 614.88
      expect(result.outputs.gstOnTp).toBe(614.88);
      // Payable Base = 3416 + 614.88 = 4030.88
      expect(result.outputs.payableSummary.payableBase).toBe(4030.88);
      // 10% Commercial discount against payable base = 403.09
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBe(403.09);
      // Total Premium = 4030.88 - 403.09 = 3627.79
      expect(result.outputs.totalPremium).toBe(3627.79);
      expect(result.outputs.finalPayableAmount).toBe(3627.79);
    });

    it('should reject unsupported NCB percentage outside discrete tiers [0, 20, 25, 35, 45, 50]', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          ncbPercent: 30,
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'UNSUPPORTED_NCB_PERCENTAGE',
        }),
      });
    });

    it('Deterministic Fixture: should calculate 10% commercial discount on payable base (₹20,000 - ₹2,000 = ₹18,000)', async () => {
      // Custom edited TP premium: 16949.15 + 18% GST (3050.85) = ₹20,000.00 Payable Base
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'THIRD_PARTY_ONLY',
        paCover: false,
        editedTpPremium: 16949.15,
        commercialDiscountPercent: 10,
      });

      expect(result.outputs.baseTpPremium).toBe(16949.15);
      expect(result.outputs.gstOnTp).toBe(3050.85);
      expect(result.outputs.payableSummary.payableBase).toBe(20000);
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBe(2000);
      expect(result.outputs.payableSummary.finalPayableAmount).toBe(18000);
      expect(result.outputs.finalPayableAmount).toBe(18000);
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

    it('PHASE 7: rejects all client-supplied add-on prices, even when approval metadata is omitted', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          addons: [{ addonCode: 'RSA', manualPrice: 300 }],
        }),
      ).rejects.toThrow('Client-supplied add-on prices are disabled');
    });

    it('PHASE 7: does not trust client-supplied approvalReference/approvedBy for add-on overrides', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          addons: [
            {
              addonCode: 'RSA',
              manualPrice: 400,
              approvalReference: 'APP-RSA-01',
              approvedBy: 'mgr-user',
              overrideReason: 'manual approval text is not proof of authorization',
            },
          ],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ADDON_MANUAL_OVERRIDE_DISABLED',
        }),
      });
    });

    it('PHASE 7: rejects large client-supplied add-on amounts before premium arithmetic', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          addons: [
            {
              addonCode: 'RSA',
              manualPrice: 100,
              approvalReference: 'APP-RSA-01',
              approvedBy: 'mgr-user',
            },
          ],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          errorCode: 'ADDON_MANUAL_OVERRIDE_DISABLED',
        }),
      });
    });

    it('PHASE 9: should reject 100% TP discount per IRDAI statutory regulations', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          tpDiscountPercent: 100,
          approvalReference: 'APP-100',
        }),
      ).rejects.toThrow(
        '100% TP discounts are strictly prohibited per IRDAI statutory regulations.',
      );
    });

    it('should reject negative parameter submissions', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          tpDiscountPercent: -5,
        }),
      ).rejects.toThrow('Negative premium, IDV, or discount parameters are disallowed.');
    });

    it('WP-03: should calculate with explicit 5% GST rate on gross base when selected', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
        gstRate: 5,
      });

      expect(result.rateConfig.gstRatePercent).toBe(5);
      expect(result.outputs.gstRatePercent).toBe(5);
      // Mandatory Rule: GST base is gross before discount (15635*0.05 + 3416*0.05 + 275*0.05 = 966.30)
      expect(result.outputs.totalGst).toBe(966.3);
      expect(result.outputs.finalPayableAmount).toBe(
        Number((result.outputs.netCustomerPremium + result.outputs.totalGst).toFixed(2)),
      );
      expect(result.outputs.gstBreakdown.base).toBe('GROSS');
      expect(result.outputs.gstBreakdown.od.rate).toBe(0.05);
    });

    it('WP-03: should calculate with explicit 18% GST rate on gross base when selected', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
        gstRate: 18,
      });

      expect(result.rateConfig.gstRatePercent).toBe(18);
      expect(result.outputs.gstRatePercent).toBe(18);
      // Mandatory Rule: Gross base (15635*0.18 + 3416*0.18 + 275*0.18 = 3478.68)
      expect(result.outputs.totalGst).toBe(3478.68);
      expect(result.outputs.finalPayableAmount).toBe(
        Number((result.outputs.netCustomerPremium + result.outputs.totalGst).toFixed(2)),
      );
    });

    it('WP-03: should calculate component-level GST with mixed rates (OD 18%, TP 5%)', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        ncbPercent: 20,
        odGstRate: 18,
        tpGstRate: 5,
        paGstRate: 18,
      });

      // OD Gross = 15635 * 0.18 = 2814.30
      // TP Gross = 3416 * 0.05 = 170.80
      // PA Gross = 275 * 0.18 = 49.50
      // Total GST = 2814.30 + 170.80 + 49.50 = 3034.60
      expect(result.outputs.gstBreakdown.od.amount).toBe(2814.3);
      expect(result.outputs.gstBreakdown.tp.amount).toBe(170.8);
      expect(result.outputs.gstBreakdown.pa.amount).toBe(49.5);
      expect(result.outputs.totalGst).toBe(3034.6);
      expect(result.outputs.finalPayableAmount).toBe(
        Number((result.outputs.netCustomerPremium + 3034.6).toFixed(2)),
      );
    });

    it('should support editable OD rate and recalculate OD gross and GST correctly', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        editedOdRate: 3.0,
      });

      // IDV 500000 * 3.0% = 15000
      expect(result.outputs.od.gross).toBe(15000);
      expect(result.outputs.od.isEdited).toBe(true);
      expect(result.rateConfig.odRate).toBe(3.0);
      expect(result.rateConfig.systemOdRate).toBe(3.127);
      expect(result.outputs.overridesApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'OD_RATE',
            overrideValue: 3.0,
            status: 'APPLIED',
          }),
        ]),
      );
      // OD GST @ 18% on 15000 = 2700
      expect(result.outputs.od.gst).toBe(2700);
    });

    it('should support editable TP premium and recalculate TP gross, net and GST correctly', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        editedTpPremium: 2500,
      });

      expect(result.outputs.tp.base).toBe(2500);
      expect(result.outputs.tp.isEdited).toBe(true);
      expect(result.rateConfig.tpAnnualRate).toBe(2500);
      expect(result.rateConfig.systemTpAnnualRate).toBe(3416);
      expect(result.outputs.overridesApplied).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'TP_PREMIUM',
            overrideValue: 2500,
            status: 'APPLIED',
          }),
        ]),
      );
      // TP GST @ 18% on 2500 = 450
      expect(result.outputs.tp.gst).toBe(450);
    });

    it('should allow small or customized TP premium without throwing out-of-bounds error', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        editedTpPremium: 100,
      });

      expect(result.outputs.tp.base).toBe(100);
      expect(result.outputs.tp.isEdited).toBe(true);
    });

    it('should reject negative edited TP premium with HTTP 400', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          editedTpPremium: -50,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('WP-03: should fail-closed and reject unapproved GST rate (e.g. 12%)', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          gstRate: 12,
        }),
      ).rejects.toThrow('The GST selector supports exactly 5% and 18% options');
    });
  });
});
