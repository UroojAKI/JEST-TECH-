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
        statutory: 3416,
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

    it('should reject discount exceeding absolute ceiling (100%)', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          discountPercent: 105,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject discount exceeding 20% without approvalReference', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          discountPercent: 35,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow discount up to 100% with approvalReference', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        discountPercent: 100,
        approvalReference: 'BM-APPROVED',
      });
      expect(result.outputs.totalDiscount).toBeGreaterThan(0);
    });

    it('should allow OD discount up to 100% and TP discount up to 100% with approvalReference', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        odDiscountPercent: 100,
        tpDiscountPercent: 100,
        approvalReference: 'BM-APPROVED',
        paCover: false,
      });
      expect(result.outputs.od.net).toBe(0);
      expect(result.outputs.tp.net).toBe(0);
      expect(result.outputs.finalPayableAmount).toBeGreaterThanOrEqual(0);
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
      expect(result.outputs.netTpComponent).toBe(3074.4);
      expect(result.outputs.tp.discount).toBe(341.6);
      expect(result.outputs.tpDiscountAmount).toBe(341.6);
      expect(result.outputs.tp.net).toBe(3074.4);
      // GST on gross TP (statutory rule): 3416 * 0.18 = 614.88
      expect(result.outputs.gstOnTp).toBe(614.88);
      // Payable Base = 3416 + 614.88 = 4030.88
      expect(result.outputs.payableSummary.payableBase).toBe(4030.88);
      // 10% TP discount on base TP = 341.6
      expect(result.outputs.tpDiscountAmount).toBe(341.6);
      expect(result.outputs.totalDiscount).toBe(341.6);
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBe(0);
      // Total Premium = Net TP (3074.4) + GST (614.88) = 3689.28
      expect(result.outputs.totalPremium).toBe(3689.28);
      expect(result.outputs.finalPayableAmount).toBe(3689.28);
    });

    it('MOTOR-REG-25: should calculate TP discount in package comprehensive and deduct from TP net and final payable', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        tpDiscountPercent: 10,
        paCover: false,
      });

      // Base OD = 500000 * 3.127% = 15635
      expect(result.outputs.baseOdPremium).toBe(15635);
      // Base TP = 3416
      expect(result.outputs.baseTpPremium).toBe(3416);
      // 10% TP discount on 3416 = 341.6
      expect(result.outputs.tp.discount).toBe(341.6);
      expect(result.outputs.tpDiscountAmount).toBe(341.6);
      expect(result.outputs.tp.net).toBe(3074.4);
      expect(result.outputs.netTpComponent).toBe(3074.4);

      // Gross Base = 15635 + 3416 = 19051
      expect(result.outputs.grossBasePremium).toBe(19051);
      // GST: OD (15635 * 0.18 = 2814.3) + TP (3416 * 0.18 = 614.88) = 3429.18
      expect(result.outputs.totalGst).toBe(3429.18);
      // Payable Base = 19051 + 3429.18 = 22480.18
      expect(result.outputs.payableSummary.payableBase).toBe(22480.18);
      // Commercial discount is 0 (TP discount is 341.6)
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBe(0);
      expect(result.outputs.tpDiscountAmount).toBe(341.6);
      expect(result.outputs.totalDiscount).toBe(341.6);
      // Final Payable = 22480.18 - 341.6 = 22138.58
      expect(result.outputs.finalPayableAmount).toBe(22138.58);
      expect(result.outputs.totalPremium).toBe(22138.58);
    });

    it('MOTOR-REG-26: should calculate both OD and TP discounts in package comprehensive and deduct from respective net components and final payable', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        odDiscountPercent: 10,
        tpDiscountPercent: 10,
        paCover: false,
      });

      // Base OD = 500000 * 3.127% = 15635
      expect(result.outputs.baseOdPremium).toBe(15635);
      expect(result.outputs.od.specialDiscount).toBe(1563.5);
      expect(result.outputs.specialDiscount).toBe(1563.5);
      expect(result.outputs.odDiscountAmount).toBe(1563.5);
      expect(result.outputs.netOdAfterDiscount).toBe(14071.5);
      expect(result.outputs.od.net).toBe(14071.5);
      expect(result.outputs.netOdComponent).toBe(14071.5);
      expect(result.outputs.netOdPremium).toBe(14071.5);

      // Base TP = 3416
      expect(result.outputs.baseTpPremium).toBe(3416);
      expect(result.outputs.tp.discount).toBe(341.6);
      expect(result.outputs.tpDiscountAmount).toBe(341.6);
      expect(result.outputs.tp.net).toBe(3074.4);
      expect(result.outputs.netTpComponent).toBe(3074.4);

      // Gross Base (Undiscounted reference) = 15635 + 3416 = 19051
      expect(result.outputs.grossBasePremium).toBe(19051);

      // Statutory GST on gross bases:
      // OD GST: 15635 * 0.18 = 2814.3
      // TP GST: 3416 * 0.18 = 614.88
      // Total GST: 3429.18
      expect(result.outputs.od.gst).toBe(2814.3);
      expect(result.outputs.tp.gst).toBe(614.88);
      expect(result.outputs.totalGst).toBe(3429.18);

      // Payable Base = 19051 + 3429.18 = 22480.18
      expect(result.outputs.payableSummary.payableBase).toBe(22480.18);

      // Total Discount = 1563.50 + 341.60 = 1905.10
      expect(result.outputs.totalDiscount).toBe(1905.1);
      expect(result.outputs.payableSummary.commercialDiscount.amount).toBe(0);
      expect(result.outputs.odDiscountAmount).toBe(1563.5);
      expect(result.outputs.tpDiscountAmount).toBe(341.6);

      // Final Payable = 22480.18 - 1905.10 = 20575.08
      // Reconciliation: OD Net (14071.5) + TP Net (3074.4) + Total GST (3429.18) = 20575.08
      expect(result.outputs.finalPayableAmount).toBe(20575.08);
      expect(result.outputs.totalPremium).toBe(20575.08);
    });

    it('MOTOR-REG-27: should calculate OD discount alone in package comprehensive without affecting TP component', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        idv: 500000,
        odDiscountPercent: 10,
        paCover: false,
      });

      expect(result.outputs.baseOdPremium).toBe(15635);
      expect(result.outputs.od.specialDiscount).toBe(1563.5);
      expect(result.outputs.od.net).toBe(14071.5);

      expect(result.outputs.baseTpPremium).toBe(3416);
      expect(result.outputs.tp.discount).toBe(0);
      expect(result.outputs.tp.net).toBe(3416);

      expect(result.outputs.totalDiscount).toBe(1563.5);
      expect(result.outputs.totalGst).toBe(3429.18);
      // Final Payable = 22480.18 - 1563.50 = 20916.68
      expect(result.outputs.finalPayableAmount).toBe(20916.68);
    });

    it('MOTOR-REG-28: should calculate OD discount in standalone OD (SAOD) and apply GST to gross OD base', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const activeTpExpiryDate = futureDate.toISOString().slice(0, 10);

      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'STANDALONE_OD',
        idv: 500000,
        odDiscountPercent: 10,
        activeTpPolicyNumber: 'TP-POL-998877',
        activeTpExpiryDate,
      });

      expect(result.outputs.baseOdPremium).toBe(15635);
      expect(result.outputs.od.specialDiscount).toBe(1563.5);
      expect(result.outputs.specialDiscount).toBe(1563.5);
      expect(result.outputs.od.net).toBe(14071.5);
      expect(result.outputs.netOdComponent).toBe(14071.5);

      // SAOD has no TP premium
      expect(result.outputs.baseTpPremium).toBe(0);
      expect(result.outputs.tp.net).toBe(0);

      // Statutory GST on gross OD base (15635 * 0.18 = 2814.30)
      expect(result.outputs.gstOnOd).toBe(2814.3);
      expect(result.outputs.totalGst).toBe(2814.3);

      // Payable Base = 15635 + 2814.30 = 18449.30
      expect(result.outputs.payableSummary.payableBase).toBe(18449.3);
      expect(result.outputs.totalDiscount).toBe(1563.5);

      // Final Payable = 18449.30 - 1563.50 = 16885.80
      // Reconciliation: OD Net (14071.5) + GST (2814.30) = 16885.80
      expect(result.outputs.finalPayableAmount).toBe(16885.8);
      expect(result.outputs.totalPremium).toBe(16885.8);
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

    it('MOTOR-REG-06: should enforce TP discount ceiling (reject > 100%)', async () => {
      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          tpDiscountPercent: 105,
          paCover: false,
        }),
      ).rejects.toThrow('Discounts exceeding 100% are strictly prohibited.');
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

    it('PHASE 9: should allow up to 100% TP discount and reject above 100%', async () => {
      const result: any = await service.calculate({
        vehicleCategory: 'PRIVATE_CAR',
        vehicleStatus: 'EXISTING',
        policyType: 'THIRD_PARTY_ONLY',
        tpDiscountPercent: 100,
        approvalReference: 'BM-APPROVED',
      });
      expect(result.outputs.tp.discount).toBe(3416);
      expect(result.outputs.tp.net).toBe(0);

      await expect(
        service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          tpDiscountPercent: 101,
        }),
      ).rejects.toThrow('Discounts exceeding 100% are strictly prohibited.');
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

    describe('Mandatory Financial Correction & Reconciliation Regression Tests (Oct 17 Audit)', () => {
      it('REG-01: TP base ₹1,000, no discount -> TP net ₹1,000; GST ₹180 at 18%', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpPremium: 1000,
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });

        expect(result.outputs.tp.base).toBe(1000);
        expect(result.outputs.tp.discount).toBe(0);
        expect(result.outputs.tp.net).toBe(1000);
        expect(result.outputs.tp.gst).toBe(180);
        expect(result.outputs.summary.grossPremium).toBe(1000);
        expect(result.outputs.summary.totalGst).toBe(180);
        expect(result.outputs.summary.finalPayable).toBe(1180);
      });

      it('REG-02: TP base ₹1,000, 10% component discount -> TP net ₹900; discount ₹100; GST ₹180 on gross base', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpPremium: 1000,
          tpDiscountPercent: 10,
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });

        // Effective base is 1000
        expect(result.outputs.tp.base).toBe(1000);
        // 10% discount on 1000 = 100
        expect(result.outputs.tp.discount).toBe(100);
        // TP net payable = 1000 - 100 = 900
        expect(result.outputs.tp.net).toBe(900);
        // GST at 18% strictly on GROSS base 1000 = 180 (not on 900)
        expect(result.outputs.tp.gst).toBe(180);
        // Summary reconciliation:
        // Gross = 1000, GST = 180, Payable Base = 1180, Discount = 100, Final Payable = 1080
        expect(result.outputs.summary.grossPremium).toBe(1000);
        expect(result.outputs.summary.totalGst).toBe(180);
        expect(result.outputs.payableSummary.payableBase).toBe(1180);
        expect(result.outputs.summary.totalDiscount).toBe(100);
        expect(result.outputs.summary.finalPayable).toBe(1080);
      });

      it('REG-03: TP statutory tariff ₹3,416, effective edited premium ₹1,000 -> clearly distinguishes both values', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedTpPremium: 1000,
          paCover: false,
          paidDriverLiability: false,
        });

        // Statutory tariff is preserved and distinguishable
        expect(result.rateConfig.systemTpAnnualRate).toBe(3416);
        expect(result.outputs.tp.statutory).toBe(3416);
        // Active effective base is 1000
        expect(result.rateConfig.tpAnnualRate).toBe(1000);
        expect(result.outputs.tp.base).toBe(1000);
        expect(result.outputs.tp.isEdited).toBe(true);
        // All downstream TP calculations use 1000, not 3416
        expect(result.outputs.tp.gst).toBe(180);
      });

      it('REG-04: OD ₹1,000 + TP ₹1,000, 18% GST, no discount -> Gross ₹2,000; GST ₹360; payable ₹2,360', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0, // 100,000 * 1% = ₹1,000 OD Gross
          editedTpPremium: 1000, // ₹1,000 TP Gross
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });

        // Component verifications
        expect(result.outputs.od.gross).toBe(1000);
        expect(result.outputs.tp.base).toBe(1000);
        expect(result.outputs.od.gst).toBe(180);
        expect(result.outputs.tp.gst).toBe(180);

        // Reconciled summary
        expect(result.outputs.summary.grossPremium).toBe(2000);
        expect(result.outputs.summary.totalGst).toBe(360);
        expect(result.outputs.payableSummary.payableBase).toBe(2360);
        expect(result.outputs.summary.totalDiscount).toBe(0);
        expect(result.outputs.summary.finalPayable).toBe(2360);
      });

      it('REG-05: OD ₹1,000 + TP ₹1,000, 10% commercial discount on payable base -> Discount ₹236; final payable ₹2,124', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0, // 100,000 * 1% = ₹1,000 OD Gross
          editedTpPremium: 1000, // ₹1,000 TP Gross
          commercialDiscountPercent: 10, // 10% on Payable Base
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });

        expect(result.outputs.summary.grossPremium).toBe(2000);
        expect(result.outputs.summary.totalGst).toBe(360);
        expect(result.outputs.payableSummary.payableBase).toBe(2360);
        // 10% of 2360 = 236
        expect(result.outputs.summary.totalDiscount).toBe(236);
        expect(result.outputs.commercialDiscountAmount).toBe(236);
        // Final Payable = 2360 - 236 = 2124
        expect(result.outputs.summary.finalPayable).toBe(2124);
        expect(result.outputs.finalPayableAmount).toBe(2124);
      });

      it('REG-06: OD 10% + TP 10% component discounts plus 10% commercial discount -> correctly itemized without duplicate deduction', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0, // ₹1,000 OD Gross
          editedTpPremium: 1000, // ₹1,000 TP Gross
          odDiscountPercent: 10, // 10% on OD = ₹100
          tpDiscountPercent: 10, // 10% on TP = ₹100
          commercialDiscountPercent: 10, // 10% on Payable Base (2360) = ₹236
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });

        // Component net deductions
        expect(result.outputs.od.specialDiscount).toBe(100);
        expect(result.outputs.od.net).toBe(900);
        expect(result.outputs.tp.discount).toBe(100);
        expect(result.outputs.tp.net).toBe(900);

        // GST is unchanged on gross bases (180 + 180 = 360)
        expect(result.outputs.summary.grossPremium).toBe(2000);
        expect(result.outputs.summary.totalGst).toBe(360);
        expect(result.outputs.payableSummary.payableBase).toBe(2360);

        // Total discount = 100 (OD) + 100 (TP) + 236 (Commercial) = 436
        expect(result.outputs.summary.totalDiscount).toBe(436);
        // Final Payable = 2360 - 436 = 1924
        expect(result.outputs.summary.finalPayable).toBe(1924);
      });

      it('REG-07: NCB changes do not affect premium, GST, discounts, or final payable', async () => {
        const baseInput = {
          vehicleCategory: 'PRIVATE_CAR' as const,
          vehicleStatus: 'EXISTING' as const,
          policyType: 'PACKAGE_COMPREHENSIVE' as const,
          idv: 500000,
          commercialDiscountPercent: 10,
          gstRate: 18,
        };

        const quoteNcb0 = await service.calculate({ ...baseInput, ncbPercent: 0 });
        const quoteNcb20 = await service.calculate({ ...baseInput, ncbPercent: 20 });
        const quoteNcb50 = await service.calculate({ ...baseInput, ncbPercent: 50 });

        // Financial figures are completely identical regardless of NCB
        expect(quoteNcb0.outputs.summary.grossPremium).toBe(quoteNcb20.outputs.summary.grossPremium);
        expect(quoteNcb20.outputs.summary.grossPremium).toBe(quoteNcb50.outputs.summary.grossPremium);

        expect(quoteNcb0.outputs.summary.totalGst).toBe(quoteNcb20.outputs.summary.totalGst);
        expect(quoteNcb0.outputs.summary.totalDiscount).toBe(quoteNcb20.outputs.summary.totalDiscount);
        expect(quoteNcb0.outputs.summary.finalPayable).toBe(quoteNcb50.outputs.summary.finalPayable);

        // Underwriting metadata captures the NCB percentage
        expect(quoteNcb0.outputs.underwriting.ncbPercentage).toBe(0);
        expect(quoteNcb20.outputs.underwriting.ncbPercentage).toBe(20);
        expect(quoteNcb50.outputs.underwriting.ncbPercentage).toBe(50);
      });

      it('REG-08: Premium edit and reset -> derived fields recalculate and agree', async () => {
        // Step 1: Default statutory calculation
        const statutory = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
        });

        // Step 2: Agent edits TP premium to 1500
        const edited = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          editedTpPremium: 1500,
        });
        expect(edited.outputs.tp.base).toBe(1500);
        expect(edited.outputs.tp.isEdited).toBe(true);
        expect(edited.outputs.tp.gst).toBe(270); // 1500 * 18%

        // Step 3: Agent resets TP premium (editedTpPremium: undefined)
        const reset = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 500000,
          editedTpPremium: undefined,
        });
        expect(reset.outputs.tp.base).toBe(statutory.outputs.tp.base);
        expect(reset.outputs.tp.isEdited).toBe(false);
        expect(reset.outputs.tp.gst).toBe(statutory.outputs.tp.gst);
        expect(reset.outputs.summary.finalPayable).toBe(statutory.outputs.summary.finalPayable);
      });
    });

    describe('Phase 9.1: Deterministic Financial Fixture & Phase 9.2 Regression Matrix', () => {
      it('Phase 9.1 Deterministic Financial Fixture: OD ₹1,000, Annual TP ₹1,000, Tenure 3, OD 10%, TP 10%, Comm 10%, GST 18%', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0, // 100,000 * 1% = ₹1,000 OD Gross
          editedTpAnnualPremium: 1000, // ₹1,000 Annual TP
          policyTenure: 3, // 3 Years Tenure -> ₹3,000 TP Gross
          paCover: false,
          paidDriverLiability: false,
          odDiscountPercent: 10,
          tpDiscountPercent: 10,
          commercialDiscountPercent: 10,
          odGstRate: 18,
          tpGstRate: 18,
        });

        // Step 1: Gross Premiums
        expect(result.outputs.od.gross).toBe(1000);
        expect(result.outputs.tp.base).toBe(3000);
        expect(result.outputs.baseTpPremium).toBe(3000);
        expect(result.outputs.payableSummary.tpGrossPremium).toBe(3000);
        expect(result.outputs.summary.grossPremium).toBe(4000);

        // Step 2: Component GST (on Gross Bases)
        expect(result.outputs.od.gst).toBe(180); // 1000 * 18%
        expect(result.outputs.tp.gst).toBe(540); // 3000 * 18%
        expect(result.outputs.summary.totalGst).toBe(720); // 180 + 540

        // Step 3: Payable Base (Gross + GST)
        expect(result.outputs.payableSummary.payableBase).toBe(4720); // 4000 + 720

        // Step 4: Independent Discounts
        expect(result.outputs.od.specialDiscount).toBe(100); // 1000 * 10%
        expect(result.outputs.odDiscountAmount).toBe(100);
        expect(result.outputs.tp.discount).toBe(300); // 3000 * 10%
        expect(result.outputs.tpDiscountAmount).toBe(300);
        expect(result.outputs.commercialDiscountAmount).toBe(472); // 4720 * 10%
        expect(result.outputs.summary.totalDiscount).toBe(872); // 100 + 300 + 472
        expect(result.outputs.payableSummary.totalDiscounts).toBe(872);

        // Step 5: Final Payable
        expect(result.outputs.summary.finalPayable).toBe(3848); // 4720 - 872
        expect(result.outputs.finalPayableAmount).toBe(3848);

        // Invariants check
        expect(result.outputs.summary.grossPremium).toBe(
          result.outputs.od.gross + result.outputs.tp.base,
        );
        expect(result.outputs.summary.totalGst).toBe(
          result.outputs.od.gst + result.outputs.tp.gst,
        );
        expect(result.outputs.summary.totalDiscount).toBe(
          result.outputs.odDiscountAmount +
            result.outputs.tpDiscountAmount +
            result.outputs.commercialDiscountAmount,
        );
        expect(result.outputs.summary.finalPayable).toBe(
          result.outputs.payableSummary.payableBase -
            result.outputs.summary.totalDiscount,
        );
      });

      it('TP-01: Annual TP ₹1,000, tenure 1 -> TP gross ₹1,000', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpAnnualPremium: 1000,
          policyTenure: 1,
          paCover: false,
          paidDriverLiability: false,
        });
        expect(result.inputs.effectiveAnnualTpPremium).toBe(1000);
        expect(result.inputs.tpTenure).toBe(1);
        expect(result.outputs.tp.base).toBe(1000);
        expect(result.outputs.baseTpPremium).toBe(1000);
        expect(result.outputs.payableSummary.tpGrossPremium).toBe(1000);
      });

      it('TP-02: Annual TP ₹1,000, tenure 3 -> TP gross ₹3,000', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpAnnualPremium: 1000,
          policyTenure: 3,
          paCover: false,
          paidDriverLiability: false,
        });
        expect(result.inputs.effectiveAnnualTpPremium).toBe(1000);
        expect(result.inputs.tpTenure).toBe(3);
        expect(result.outputs.tp.base).toBe(3000);
        expect(result.outputs.baseTpPremium).toBe(3000);
        expect(result.outputs.payableSummary.tpGrossPremium).toBe(3000);
      });

      it('TP-03: TP discount 10% -> Discount ₹300 on ₹3,000 gross', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpAnnualPremium: 1000,
          policyTenure: 3,
          tpDiscountPercent: 10,
          paCover: false,
          paidDriverLiability: false,
        });
        expect(result.outputs.tp.base).toBe(3000);
        expect(result.outputs.baseTpPremium).toBe(3000);
        expect(result.outputs.tp.discount).toBe(300);
        expect(result.outputs.tpDiscountAmount).toBe(300);
        expect(result.outputs.tp.net).toBe(2700);
      });

      it('TP-04: Change tenure from 1 to 3 years -> TP gross and dependent calculations update', async () => {
        const quote1Year: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpAnnualPremium: 1000,
          policyTenure: 1,
          tpDiscountPercent: 10,
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });
        expect(quote1Year.outputs.tp.base).toBe(1000);
        expect(quote1Year.outputs.baseTpPremium).toBe(1000);
        expect(quote1Year.outputs.tp.discount).toBe(100);
        expect(quote1Year.outputs.tp.gst).toBe(180);
        expect(quote1Year.outputs.finalPayableAmount).toBe(1080); // 1000 + 180 - 100

        const quote3Year: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'THIRD_PARTY_ONLY',
          editedTpAnnualPremium: 1000,
          policyTenure: 3,
          tpDiscountPercent: 10,
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });
        expect(quote3Year.outputs.tp.base).toBe(3000);
        expect(quote3Year.outputs.baseTpPremium).toBe(3000);
        expect(quote3Year.outputs.tp.discount).toBe(300);
        expect(quote3Year.outputs.tp.gst).toBe(540);
        expect(quote3Year.outputs.finalPayableAmount).toBe(3240); // 3000 + 540 - 300
      });

      it('OD-01: OD discount 10% -> OD gross unchanged; discount ₹100', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'STANDALONE_OD',
          idv: 100000,
          editedOdRate: 1.0,
          odDiscountPercent: 10,
          activeTpPolicyNumber: 'POL-12345',
          activeTpExpiryDate: new Date(Date.now() + 180 * 86400000).toISOString(),
        });
        expect(result.outputs.od.gross).toBe(1000);
        expect(result.outputs.od.specialDiscount).toBe(100);
        expect(result.outputs.odDiscountAmount).toBe(100);
        expect(result.outputs.od.net).toBe(900);
        expect(result.outputs.od.gst).toBe(180); // 18% on gross 1000
      });

      it('DISC-01: Commercial discount 10% -> Discount calculated on payable base', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          policyTenure: 1,
          commercialDiscountPercent: 10,
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });
        // Gross: 1000 + 1000 = 2000. GST: 180 + 180 = 360. Payable base: 2360.
        expect(result.outputs.payableSummary.payableBase).toBe(2360);
        expect(result.outputs.commercialDiscountAmount).toBe(236);
        expect(result.outputs.summary.finalPayable).toBe(2124);
      });

      it('DISC-02: All three discounts -> Each calculated and deducted once', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          policyTenure: 1,
          odDiscountPercent: 10, // 10% of 1000 = 100
          tpDiscountPercent: 10, // 10% of 1000 = 100
          commercialDiscountPercent: 10, // 10% of 2360 = 236
          paCover: false,
          paidDriverLiability: false,
          gstRate: 18,
        });
        expect(result.outputs.odDiscountAmount).toBe(100);
        expect(result.outputs.tpDiscountAmount).toBe(100);
        expect(result.outputs.commercialDiscountAmount).toBe(236);
        expect(result.outputs.summary.totalDiscount).toBe(436);
        expect(result.outputs.summary.finalPayable).toBe(2360 - 436);
      });

      it('DISC-03: Change OD discount only -> TP and commercial input percentages remain unchanged', async () => {
        const input1 = {
          vehicleCategory: 'PRIVATE_CAR' as const,
          vehicleStatus: 'EXISTING' as const,
          policyType: 'PACKAGE_COMPREHENSIVE' as const,
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          odDiscountPercent: 10,
          tpDiscountPercent: 5,
          commercialDiscountPercent: 8,
          paCover: false,
          paidDriverLiability: false,
        };
        const r1: any = await service.calculate(input1);
        const r2: any = await service.calculate({ ...input1, odDiscountPercent: 15 });

        expect(r2.outputs.tpDiscountAmount).toBe(r1.outputs.tpDiscountAmount);
        expect(r2.outputs.commercialDiscountAmount).toBe(r1.outputs.commercialDiscountAmount);
        expect(r2.outputs.odDiscountAmount).toBe(150);
      });

      it('DISC-04: Change TP discount only -> OD and commercial input percentages remain unchanged', async () => {
        const input1 = {
          vehicleCategory: 'PRIVATE_CAR' as const,
          vehicleStatus: 'EXISTING' as const,
          policyType: 'PACKAGE_COMPREHENSIVE' as const,
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          odDiscountPercent: 10,
          tpDiscountPercent: 5,
          commercialDiscountPercent: 8,
          paCover: false,
          paidDriverLiability: false,
        };
        const r1: any = await service.calculate(input1);
        const r2: any = await service.calculate({ ...input1, tpDiscountPercent: 12 });

        expect(r2.outputs.odDiscountAmount).toBe(r1.outputs.odDiscountAmount);
        expect(r2.outputs.commercialDiscountAmount).toBe(r1.outputs.commercialDiscountAmount);
        expect(r2.outputs.tpDiscountAmount).toBe(120);
      });

      it('GST-01: GST calculation -> Each component GST uses its approved gross base', async () => {
        const result: any = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 2.0, // 2000 OD Gross
          editedTpAnnualPremium: 1000, // 1000 TP Gross
          odDiscountPercent: 20, // 400 OD Discount -> Net OD = 1600
          tpDiscountPercent: 15, // 150 TP Discount -> Net TP = 850
          approvalReference: 'BM-AUTH-01',
          odGstRate: 18,
          tpGstRate: 5,
          paCover: false,
          paidDriverLiability: false,
        });

        // GST is strictly computed on Gross Bases (2000 and 1000), not Net (1600 and 850)
        expect(result.outputs.gstBreakdown.od.base).toBe(2000);
        expect(result.outputs.gstBreakdown.od.amount).toBe(360); // 2000 * 18%
        expect(result.outputs.gstBreakdown.tp.base).toBe(1000);
        expect(result.outputs.gstBreakdown.tp.amount).toBe(50); // 1000 * 5%
        expect(result.outputs.summary.totalGst).toBe(410); // 360 + 50
      });

      it('NCB-01: Change NCB tier -> No monetary output changes', async () => {
        const quote0 = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          ncbPercent: 0,
          paCover: false,
          paidDriverLiability: false,
        });
        const quote50 = await service.calculate({
          vehicleCategory: 'PRIVATE_CAR',
          vehicleStatus: 'EXISTING',
          policyType: 'PACKAGE_COMPREHENSIVE',
          idv: 100000,
          editedOdRate: 1.0,
          editedTpAnnualPremium: 1000,
          ncbPercent: 50,
          paCover: false,
          paidDriverLiability: false,
        });
        expect(quote0.outputs.summary.grossPremium).toBe(quote50.outputs.summary.grossPremium);
        expect(quote0.outputs.summary.totalGst).toBe(quote50.outputs.summary.totalGst);
        expect(quote0.outputs.summary.finalPayable).toBe(quote50.outputs.summary.finalPayable);
      });

      it('VALID-01: Negative or non-finite premium is rejected', async () => {
        await expect(
          service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'THIRD_PARTY_ONLY',
            editedTpAnnualPremium: -100,
          }),
        ).rejects.toThrow();
      });

      it('VALID-02: Discount exceeding 100% is rejected server-side', async () => {
        await expect(
          service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 500000,
            commercialDiscountPercent: 105,
          }),
        ).rejects.toThrow('Discounts exceeding 100% are strictly prohibited.');
      });

      it('VALID-03: Discount outside configured absolute limit is rejected', async () => {
        await expect(
          service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 500000,
            commercialDiscountPercent: 105,
            approvalReference: 'BM-AUTH-999',
          }),
        ).rejects.toThrow('Discounts exceeding 100% are strictly prohibited.');
      });

      describe('Phase 2/3/4 Direct Rupees & High IDV Suite', () => {
        it('DIRECT-OD-01: Direct OD premium ₹ input bypasses IDV × rate formula', async () => {
          const res = await service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 500000,
            odPremiumAmount: 3000,
            editedTpAnnualPremium: 1000,
            policyTenure: 1,
            paCover: false,
            paidDriverLiability: false,
          });
          expect(res.outputs.od.gross).toBe(3000);
          expect(res.outputs.baseOdPremium).toBe(3000);
          expect(res.outputs.od.isEdited).toBe(true);
        });

        it('COMM-ADJ-01: Fixed rupee commercial adjustment deducted from payable base', async () => {
          const res = await service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 500000,
            odPremiumAmount: 3000,
            editedTpAnnualPremium: 1000,
            policyTenure: 1,
            paCover: false,
            paidDriverLiability: false,
            commercialAdjustmentAmount: 500,
          });
          // Gross = 3000 + 1000 = 4000
          // GST 18% = 540 + 180 = 720
          // Payable Base = 4720
          // Commercial Adj = 500
          // Final Payable = 4720 - 500 = 4220
          expect(res.outputs.payableSummary.payableBase).toBe(4720);
          expect(res.outputs.payableSummary.commercialAdjustmentAmount).toBe(500);
          expect(res.outputs.totalDiscountAmount).toBe(500);
          expect(res.outputs.finalPayableAmount).toBe(4220);
        });

        it('COMM-ADJ-02: Commercial adjustment exceeding payable base is rejected', async () => {
          await expect(
            service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 500000,
              odPremiumAmount: 1000,
              editedTpAnnualPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
              commercialAdjustmentAmount: 50000, // Payable base is only ₹2,360
            }),
          ).rejects.toThrow('exceeds payable base');
        });

        it('IDV-01: Large IDV values (> 6 digits, e.g. ₹15,00,000 and ₹50,00,000) are fully supported', async () => {
          const res15L = await service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 1500000,
            editedTpAnnualPremium: 1000,
            policyTenure: 1,
            paCover: false,
            paidDriverLiability: false,
          });
          expect(res15L.outputs.od.gross).toBeGreaterThan(0);

          const res50L = await service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 5000000,
            editedTpAnnualPremium: 1000,
            policyTenure: 1,
            paCover: false,
            paidDriverLiability: false,
          });
          expect(res50L.outputs.od.gross).toBeGreaterThan(0);
        });

        it('DETERMINISTIC-FIXTURE-CANONICAL: OD ₹3,000, Annual TP ₹1,000 × 3, OD 10%, TP 10%, Comm Adj ₹500 -> ₹5,980', async () => {
          const res = await service.calculate({
            vehicleCategory: 'PRIVATE_CAR',
            vehicleStatus: 'EXISTING',
            policyType: 'PACKAGE_COMPREHENSIVE',
            idv: 250000,
            odPremiumAmount: 3000,
            editedTpAnnualPremium: 1000,
            policyTenure: 3,
            odDiscountPercent: 10,
            tpDiscountPercent: 10,
            commercialAdjustmentAmount: 500,
            paCover: false,
            paidDriverLiability: false,
            odGstRate: 18,
            tpGstRate: 18,
          });

          // Reconciliation Verification:
          // OD Premium: ₹3,000 | TP Gross: ₹1,000 × 3 = ₹3,000
          expect(res.outputs.od.gross).toBe(3000);
          expect(res.outputs.tp.base).toBe(3000);

          // Gross Premium Before Discount: ₹6,000
          expect(res.outputs.payableSummary.grossPremium).toBe(6000);

          // Itemized GST: OD ₹540 + TP ₹540 = ₹1,080
          expect(res.outputs.od.gst).toBe(540);
          expect(res.outputs.tp.gst).toBe(540);
          expect(res.outputs.payableSummary.componentGstTotal).toBe(1080);

          // Payable Base: ₹7,080
          expect(res.outputs.payableSummary.payableBase).toBe(7080);

          // Deductions: OD ₹300, TP ₹300, Commercial Adj ₹500 = ₹1,100
          expect(res.outputs.odDiscountAmount).toBe(300);
          expect(res.outputs.tpDiscountAmount).toBe(300);
          expect(res.outputs.commercialDiscountAmount).toBe(500);
          expect(res.outputs.totalDiscountAmount).toBe(1100);

          // Final Payable: ₹7,080 - ₹1,100 = ₹5,980
          expect(res.outputs.finalPayableAmount).toBe(5980);
          expect(res.outputs.summary.finalPayable).toBe(5980);
        });

        describe('Phase 10: Complete OD Rate Removal & Canonical Contract Verification', () => {
          it('OD-RATE-REMOVAL-01: OD premium ₹3,000 with valid IDV succeeds without OD-rate validation', async () => {
            const res = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 500000,
              odPremium: 3000,
              editedTpAnnualPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
            });
            expect(res.outputs.baseOdPremium).toBe(3000);
            expect(res.outputs.od.gross).toBe(3000);
            expect(res.outputs.odPremium).toBe(3000);
          });

          it('OD-RATE-REMOVAL-02: Same OD premium ₹3,000 with different IDVs produces identical OD gross premium ₹3,000', async () => {
            const res1 = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 300000,
              odPremium: 3000,
              editedTpAnnualPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
            });
            const res2 = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 1200000,
              odPremium: 3000,
              editedTpAnnualPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
            });
            expect(res1.outputs.baseOdPremium).toBe(3000);
            expect(res2.outputs.baseOdPremium).toBe(3000);
            expect(res1.outputs.od.gross).toBe(res2.outputs.od.gross);
          });

          it('OD-RATE-REMOVAL-03: Legacy input passing editedOdRate of 0.013% does not throw OD_RATE_OUT_OF_BOUNDS', async () => {
            const res = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 500000,
              editedOdRate: 0.013,
              editedTpAnnualPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
            });
            expect(res).toBeDefined();
            expect(res.outputs.finalPayableAmount).toBeGreaterThan(0);
          });

          it('DISCOUNTS-EXCEED-PAYABLE-BASE: Total deductions exceeding payable base are rejected', async () => {
            await expect(
              service.calculate({
                vehicleCategory: 'PRIVATE_CAR',
                vehicleStatus: 'EXISTING',
                policyType: 'PACKAGE_COMPREHENSIVE',
                idv: 500000,
                odPremium: 1000,
                editedTpAnnualPremium: 1000,
                policyTenure: 1,
                odDiscountPercent: 50,
                tpDiscountPercent: 50,
                approvalReference: 'BM-APPROVED',
                commercialAdjustment: 2000, // Payable base is ₹2,360, discounts = ₹500 + ₹500 + ₹2,000 = ₹3,000 > ₹2,360
                paCover: false,
                paidDriverLiability: false,
              }),
            ).rejects.toThrow('exceed payable base');
          });

          it('CANONICAL-CONTRACT-FIELDS: Outputs and payableSummary expose all canonical contract fields', async () => {
            const res = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 450000,
              odPremium: 3000,
              annualTpPremium: 1000,
              tenure: 3,
              odDiscountPercent: 10,
              tpDiscountPercent: 10,
              commercialAdjustment: 500,
              paCover: false,
              paidDriverLiability: false,
            });

            // Canonical Contract on outputs:
            expect(res.outputs.idv).toBe(450000);
            expect(res.outputs.odPremium).toBe(3000);
            expect(res.outputs.annualTpPremium).toBe(1000);
            expect(res.outputs.tenure).toBe(3);
            expect(res.outputs.odDiscount).toBe(300);
            expect(res.outputs.tpDiscount).toBe(300);
            expect(res.outputs.commercialAdjustment).toBe(500);
            expect(res.outputs.gstTotal).toBe(1080);
            expect(res.outputs.finalPayable).toBe(5980);

            // Canonical Contract on payableSummary:
            expect(res.outputs.payableSummary.odPremium).toBe(3000);
            expect(res.outputs.payableSummary.annualTpPremium).toBe(1000);
            expect(res.outputs.payableSummary.tenure).toBe(3);
            expect(res.outputs.payableSummary.odDiscount).toBe(300);
            expect(res.outputs.payableSummary.tpDiscount).toBe(300);
            expect(res.outputs.payableSummary.commercialAdjustment).toBe(500);
            expect(res.outputs.payableSummary.gstTotal).toBe(1080);
            expect(res.outputs.payableSummary.finalPayable).toBe(5980);
          });
        });

        describe('Final Motor Quotation Plan: SAOD, TP Tenure, TP Add-ons, Signed Commercial Adjustment', () => {
          it('SAOD-01: Manual direct OD premium entry is independent of IDV', async () => {
            const res1 = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'STANDALONE_OD',
              idv: 500000,
              odPremiumAmount: 4500,
              activeTpPolicyNumber: 'TP-POL-12345',
              activeTpExpiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            });
            const res2 = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'STANDALONE_OD',
              idv: 2500000,
              odPremiumAmount: 4500,
              activeTpPolicyNumber: 'TP-POL-12345',
              activeTpExpiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
            });

            expect(res1.outputs.baseOdPremium).toBe(4500);
            expect(res2.outputs.baseOdPremium).toBe(4500);
            expect(res1.outputs.odPremium).toBe(4500);
            expect(res2.outputs.odPremium).toBe(4500);
          });

          it('TP-TENURE-01: Validates and enforces mandated tenures for NEW vehicles without silent fallback', async () => {
            // NEW Private Car must be 3 years
            const newCarValid = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'NEW',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 800000,
              odPremium: 10000,
              annualTpPremium: 2000,
              policyTenure: 3,
            });
            expect(newCarValid.outputs.tenure).toBe(3);
            expect(newCarValid.outputs.baseTpPremium).toBe(6000);

            // NEW Private Car with tenure 1 must be rejected with explanation
            await expect(
              service.calculate({
                vehicleCategory: 'PRIVATE_CAR',
                vehicleStatus: 'NEW',
                policyType: 'PACKAGE_COMPREHENSIVE',
                idv: 800000,
                odPremium: 10000,
                annualTpPremium: 2000,
                policyTenure: 1,
              }),
            ).rejects.toThrow('IRDAI mandates a 3-Year Long Term TP policy');

            // NEW Bike must be 5 years
            const newBikeValid = await service.calculate({
              vehicleCategory: 'BIKE',
              vehicleStatus: 'NEW',
              policyType: 'PACKAGE_COMPREHENSIVE',
              idv: 100000,
              odPremium: 2000,
              annualTpPremium: 1000,
              policyTenure: 5,
            });
            expect(newBikeValid.outputs.tenure).toBe(5);
            expect(newBikeValid.outputs.baseTpPremium).toBe(5000);

            // NEW Bike with tenure 3 must be rejected
            await expect(
              service.calculate({
                vehicleCategory: 'BIKE',
                vehicleStatus: 'NEW',
                policyType: 'PACKAGE_COMPREHENSIVE',
                idv: 100000,
                odPremium: 2000,
                annualTpPremium: 1000,
                policyTenure: 3,
              }),
            ).rejects.toThrow('IRDAI mandates a 5-Year Long Term TP policy');

            // Commercial vehicle with tenure 3 must be rejected
            await expect(
              service.calculate({
                vehicleCategory: 'GOODS_CARRYING_PUBLIC' as any,
                vehicleStatus: 'NEW',
                policyType: 'PACKAGE_COMPREHENSIVE',
                idv: 1500000,
                odPremium: 25000,
                annualTpPremium: 15000,
                policyTenure: 3,
              }),
            ).rejects.toThrow('Commercial vehicles only support a 1-Year TP policy');
          });

          it('TP-TENURE-02: Existing bike supports 5-year tenure and calculates TP gross = annual × tenure', async () => {
            const res = await service.calculate({
              vehicleCategory: 'BIKE',
              vehicleStatus: 'EXISTING',
              policyType: 'THIRD_PARTY_ONLY',
              annualTpPremium: 1000,
              policyTenure: 5,
              paCover: false,
              paidDriverLiability: false,
            });
            expect(res.outputs.tenure).toBe(5);
            expect(res.outputs.baseTpPremium).toBe(5000);
            expect(res.outputs.finalPayableAmount).toBe(5900); // 5000 + 18% GST (900)
          });

          it('TP-ADDONS-01: TP-only policy supports independent add-on selection, discounts, and mixed GST rates', async () => {
            const res = await service.calculate({
              vehicleCategory: 'PRIVATE_CAR',
              vehicleStatus: 'EXISTING',
              policyType: 'THIRD_PARTY_ONLY',
              annualTpPremium: 1000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
              addons: [
                {
                  addonCode: 'PA_UNNAMED_PASSENGER',
                  amount: 250,
                  discountPercent: 10,
                  gstRate: 18,
                },
                {
                  addonCode: 'LEGAL_LIABILITY_PAID_DRIVER',
                  amount: 50,
                  discountPercent: 0,
                  gstRate: 5,
                },
              ],
            });

            // TP Gross = 1000, GST 18% = 180
            // PA_UNNAMED: Gross = 250, Discount 10% = 25, GST 18% on gross = 45
            // LL_PAID_DRIVER: Gross = 50, Discount 0% = 0, GST 5% on gross = 2.5
            // Total Add-on Gross = 300
            // Total Add-on Discount = 25
            // Total Add-on GST = 47.5
            // Component GST Total = 180 + 47.5 = 227.5
            // Gross Premium = 1000 + 300 = 1300
            // Total Discounts = 25
            // Final Payable = 1300 + 227.5 - 25 = 1502.5
            expect(res.outputs.addonPremium).toBe(300);
            expect(res.outputs.payableSummary.addonDiscountAmount).toBe(25);
            expect(res.outputs.payableSummary.addonGstTotal).toBe(47.5);
            expect(res.outputs.gstTotal).toBe(227.5);
            expect(res.outputs.finalPayableAmount).toBe(1502.5);

            // Itemized breakdown:
            expect(res.outputs.itemizedAddons).toHaveLength(2);
            const paAddon = res.outputs.itemizedAddons?.find((a: any) => a.addonCode === 'PA_UNNAMED_PASSENGER');
            expect(paAddon).toBeDefined();
            expect(paAddon?.amount).toBe(250);
            expect(paAddon?.discountAmount).toBe(25);
            expect(paAddon?.gstAmount).toBe(45);
            expect(paAddon?.totalAmount).toBe(270);
          });

          it('COMM-ADJ-DIRECTION-01: Commercial adjustment ADD increases payable; SUBTRACT decreases payable', async () => {
            const baseInput = {
              vehicleCategory: 'PRIVATE_CAR' as const,
              vehicleStatus: 'EXISTING' as const,
              policyType: 'PACKAGE_COMPREHENSIVE' as const,
              idv: 500000,
              odPremium: 5000,
              annualTpPremium: 3000,
              policyTenure: 1,
              paCover: false,
              paidDriverLiability: false,
            };
            // Gross = 8000, GST 18% = 1440. Payable before adjustment = 9440.

            // 1. Direction: ADD (+500) -> 9440 + 500 = 9940
            const addRes = await service.calculate({
              ...baseInput,
              commercialAdjustmentAmount: 500,
              commercialAdjustmentDirection: 'ADD',
            });
            expect(addRes.outputs.payableBeforeAdjustment).toBe(9440);
            expect(addRes.outputs.signedCommercialAdjustment).toBe(500);
            expect(addRes.outputs.commercialAdjustmentDirection).toBe('ADD');
            expect(addRes.outputs.commercialDiscountAmount).toBe(0); // Loading, not a discount
            expect(addRes.outputs.finalPayableAmount).toBe(9940);
            expect(addRes.outputs.payableSummary.finalPayableAmount).toBe(9940);

            // 2. Direction: SUBTRACT (-500) -> 9440 - 500 = 8940
            const subRes = await service.calculate({
              ...baseInput,
              commercialAdjustmentAmount: 500,
              commercialAdjustmentDirection: 'SUBTRACT',
            });
            expect(subRes.outputs.payableBeforeAdjustment).toBe(9440);
            expect(subRes.outputs.signedCommercialAdjustment).toBe(-500);
            expect(subRes.outputs.commercialAdjustmentDirection).toBe('SUBTRACT');
            expect(subRes.outputs.commercialDiscountAmount).toBe(500);
            expect(subRes.outputs.finalPayableAmount).toBe(8940);
            expect(subRes.outputs.payableSummary.finalPayableAmount).toBe(8940);

            // 3. Direction: SUBTRACT exceeding payable before adjustment is rejected
            await expect(
              service.calculate({
                ...baseInput,
                commercialAdjustmentAmount: 15000,
                commercialAdjustmentDirection: 'SUBTRACT',
              }),
            ).rejects.toThrow('exceeds payable base');
          });
        });
      });
    });
  });
});

