import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RatingRuleType, Prisma } from '@prisma/client';

@Injectable()
export class RatingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  async calculatePremium(params: {
    variantId: string;
    insurerId: string;
    productId: string;
    vehicleAgeYears: number;
    ncbPercentage?: number;
    rtoZone?: string;
    selectedAddons?: string[];
    manualIdv?: number;
    isOwnerDriver?: boolean;
  }) {
    const {
      variantId,
      insurerId,
      productId,
      vehicleAgeYears = 0,
      ncbPercentage = 0,
      rtoZone = 'ZONE_A',
      selectedAddons = [],
      manualIdv,
      isOwnerDriver = true,
    } = params;

    // NCB Validation
    const validNcbSlabs = [0, 20, 25, 35, 45, 50];
    if (!validNcbSlabs.includes(ncbPercentage)) {
      throw new BadRequestException(`Invalid NCB Percentage. Must be one of: ${validNcbSlabs.join(', ')}`);
    }

    const variant = await this.prisma.vehicleVariant.findUnique({
      where: { id: variantId },
      include: { model: true },
    });

    if (!variant) {
      throw new NotFoundException('Vehicle variant not found');
    }

    const exShowroom = Number(variant.exShowroomPrice);

    // Calculate IDV based on vehicle age depreciation or mutually agreed value
    let idv = 0;
    if (vehicleAgeYears > 5) {
      if (!manualIdv) {
        throw new BadRequestException('Manual IDV is required for vehicles older than 5 years');
      }
      idv = manualIdv;
    } else {
      let idvDepreciation = 0.05; // 5% for brand new
      if (vehicleAgeYears === 1) idvDepreciation = 0.15;
      else if (vehicleAgeYears === 2) idvDepreciation = 0.2;
      else if (vehicleAgeYears === 3) idvDepreciation = 0.3;
      else if (vehicleAgeYears === 4) idvDepreciation = 0.4;
      else if (vehicleAgeYears === 5) idvDepreciation = 0.5;
      idv = exShowroom * (1 - idvDepreciation);
    }

    const rules = await this.prisma.ratingRule.findMany({
      where: {
        insurerId,
        productId,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Compute Own Damage (OD) Base Premium
    const baseRateRule = rules.find(
      (r) => r.ruleType === RatingRuleType.BASE_RATE,
    );
    let odRate = 0.025; // 2.5% default Own Damage rate
    if (baseRateRule) {
      const rateVal = (baseRateRule.formulaOrRate as any).rate;
      if (rateVal) odRate = Number(rateVal);
    }

    let baseOdPremium = idv * odRate;

    // Apply age loading if rule exists
    const ageRule = rules.find(
      (r) => r.ruleType === RatingRuleType.AGE_LOADING,
    );
    if (ageRule && vehicleAgeYears > 5) {
      const loadingPct = (ageRule.formulaOrRate as any).loadingPct || 0.1;
      baseOdPremium += baseOdPremium * Number(loadingPct);
    }

    // Apply own damage discounts
    const odDiscountRule = rules.find(
      (r) => r.ruleType === RatingRuleType.OD_DISCOUNT,
    );
    let odDiscountFactor = 0;
    if (odDiscountRule) {
      const discount = (odDiscountRule.formulaOrRate as any).discountPct;
      if (discount) odDiscountFactor = Number(discount);
    }
    const odDiscountAmount = baseOdPremium * odDiscountFactor;

    // Apply NCB Discount (on OD premium after basic discounts)
    let ncbDiscountAmount = 0;
    if (ncbPercentage > 0) {
      ncbDiscountAmount =
        (baseOdPremium - odDiscountAmount) * (ncbPercentage / 100);
    }

    const finalOdPremium = Math.max(
      baseOdPremium - odDiscountAmount - ncbDiscountAmount,
      0,
    );

    // Compute Third Party (TP) Premium based on engine capacity / GVW
    // Entire block is try/catch: covers DB failure, network timeout, AND JSON parse errors
    let tpPremium = 0;
    try {
      const tpConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'tp_rates' } });
      if (tpConfig && tpConfig.value) {
        const parsed = JSON.parse(tpConfig.value);
        const cc = variant.engineCapacity; // also used as GVW for CVs
        const vType = variant.model.vehicleType as string;
        const is4W = ['FOUR_WHEELER', 'PRIVATE_CAR_1YR', 'PRIVATE_CAR_3YR_MANDATORY_TP', 'ELECTRIC_VEHICLE_EV_SPECIAL', 'MISCELLANEOUS_VEHICLE_SPECIAL'].includes(vType);
        const is2W = ['TWO_WHEELER', 'TWO_WHEELER_1YR', 'TWO_WHEELER_5YR_MANDATORY_TP'].includes(vType);
        const isCV = ['COMMERCIAL', 'GOODS_CARRYING_COMMERCIAL_GCV', 'PASSENGER_CARRYING_COMMERCIAL_PCV'].includes(vType);
        if (is4W) {
          if (cc <= 1000) tpPremium = parsed.pc?.upto_1000cc || 2094;
          else if (cc <= 1500) tpPremium = parsed.pc?.['1001_to_1500cc'] || 3416;
          else tpPremium = parsed.pc?.above_1500cc || 7897;
        } else if (is2W) {
          if (cc <= 75) tpPremium = parsed.tw?.upto_75cc || 538;
          else if (cc <= 150) tpPremium = parsed.tw?.['76_to_150cc'] || 714;
          else if (cc <= 350) tpPremium = parsed.tw?.['151_to_350cc'] || 1366;
          else tpPremium = parsed.tw?.above_350cc || 2804;
        } else if (isCV) {
          if (cc <= 7500) tpPremium = parsed.cv?.upto_7500kg || 16049;
          else if (cc <= 12000) tpPremium = parsed.cv?.['7501_to_12000kg'] || 27186;
          else if (cc <= 20000) tpPremium = parsed.cv?.['12001_to_20000kg'] || 35313;
          else if (cc <= 40000) tpPremium = parsed.cv?.['20001_to_40000kg'] || 43950;
          else tpPremium = parsed.cv?.above_40000kg || 44242;
        }
      }
    } catch (_e) {
      // DB or parse failure — tpPremium stays 0, hardcoded fallback applies below
    }
    if (tpPremium === 0) {
       // Graceful degradation fallback (IRDAI mandated rates)
       const cc = variant.engineCapacity;
       const vType = variant.model.vehicleType as string;
       const is4W = ['FOUR_WHEELER', 'PRIVATE_CAR_1YR', 'PRIVATE_CAR_3YR_MANDATORY_TP', 'ELECTRIC_VEHICLE_EV_SPECIAL', 'MISCELLANEOUS_VEHICLE_SPECIAL'].includes(vType);
       if (is4W) {
         if (cc <= 1000) tpPremium = 2094;
         else if (cc <= 1500) tpPremium = 3416;
         else tpPremium = 7897;
       } else {
         tpPremium = 2099; // generic fallback for 2W/CV
       }
    }

    // Compute CPA Premium
    let cpaPremium = 0;
    if (isOwnerDriver) {
      cpaPremium = 788; // Hardcoded fallback (IRDAI mandated ₹788)
      try {
        const cpaConfig = await this.prisma.systemConfig.findUnique({ where: { key: 'cpa_premium' } });
        if (cpaConfig && cpaConfig.value) {
          cpaPremium = Number(cpaConfig.value) || 788;
        }
      } catch (_e) {
        // DB lookup failed — stay with hardcoded ₹788
      }
    }

    // Compute Add-on premiums
    let addonPremium = 0;
    const addonDetails: { name: string; premium: number }[] = [];

    const zeroDepActive = selectedAddons.includes('ZERO_DEP');
    if (zeroDepActive) {
      const zeroDepRate = 0.005; // 0.5% of IDV
      const zeroDepVal = idv * zeroDepRate;
      addonPremium += zeroDepVal;
      addonDetails.push({
        name: 'Zero Depreciation Cover',
        premium: Number(zeroDepVal.toFixed(0)),
      });
    }

    const engineProtectActive = selectedAddons.includes('ENGINE_PROTECT');
    if (engineProtectActive) {
      const engineRate = 0.0015; // 0.15% of IDV
      const engineVal = idv * engineRate;
      addonPremium += engineVal;
      addonDetails.push({
        name: 'Engine Protection Cover',
        premium: Number(engineVal.toFixed(0)),
      });
    }

    // Consolidation and Segregated GST Calculation
    const isCommercial = ['COMMERCIAL_GCV', 'TAXI', 'BUS_COACH', 'MISC_CLASS_D', 'AUTO_RICKSHAW'].includes(variant.model.vehicleType);
    
    // Default rates
    let odGstRate = 0.18;
    let tpGstRate = 0.18;

    // Apply different tax rates for commercial vehicles if needed based on business rules
    if (isCommercial) {
      // In many jurisdictions, commercial passenger/goods TP liability may have 12% GST instead of 18%.
      // This allows the rating engine to diverge safely.
      tpGstRate = 0.18; // Placeholder: set to 0.12 if commercial TP GST drops to 12%
    }

    const odNetPremium = finalOdPremium + addonPremium; // OD and OD-addons
    const tpNetPremium = tpPremium + cpaPremium; // Liability and CPA

    const odGst = odNetPremium * odGstRate;
    const tpGst = tpNetPremium * tpGstRate;
    const totalGst = odGst + tpGst;
    
    const netPremium = odNetPremium + tpNetPremium;
    const totalPremium = netPremium + totalGst;

    return {
      exShowroom: Math.round(exShowroom),
      idv: Math.round(idv),
      vehicleAgeYears,
      calculations: {
        ownDamage: {
          base: Math.round(baseOdPremium),
          discount: Math.round(odDiscountAmount),
          ncbDiscount: Math.round(ncbDiscountAmount),
          final: Math.round(finalOdPremium),
        },
        thirdParty: Math.round(tpPremium),
        cpaPremium: Math.round(cpaPremium),
        addons: {
          total: Math.round(addonPremium),
          breakdown: addonDetails,
        },
        netPremium: Math.round(netPremium),
        gst: Math.round(totalGst),
        odGst: Math.round(odGst),
        tpGst: Math.round(tpGst),
        totalPremium: Math.round(totalPremium),
      },
    };
  }

  /**
   * Arbitrary-Precision Financial Invariance calculation engine utilizing Prisma.Decimal
   * Mandated by SDP Volume 2 & Volume 3 (Chapter 10.1).
   */
  computeComprehensivePolicyMath(payload: {
    vehicleCategory: string;
    cubicCapacity: number;
    exShowroomPrice: Prisma.Decimal;
    depreciationPercentage: Prisma.Decimal;
  }): {
    insuredDeclaredValue: Prisma.Decimal;
    netOwnDamagePremium: Prisma.Decimal;
    netThirdPartyPremium: Prisma.Decimal;
    ownDamageTaxGst: Prisma.Decimal;
    thirdPartyTaxGst: Prisma.Decimal;
    totalTaxGst: Prisma.Decimal;
    netCustomerPayablePremium: Prisma.Decimal;
  } {
    const { exShowroomPrice, depreciationPercentage, cubicCapacity, vehicleCategory } = payload;
    
    // Calculate exact IDV after statutory depreciation (Banker's Rounding)
    const depFactor = new Prisma.Decimal('1').sub(depreciationPercentage.div(100));
    const insuredDeclaredValue = exShowroomPrice.mul(depFactor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);

    // Compute basic OD premium at standard statutory rate (e.g. 2.5% of IDV)
    const odRate = new Prisma.Decimal('0.025');
    const netOwnDamagePremium = insuredDeclaredValue.mul(odRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);

    // Compute statutory TP mandatory premium based on vehicle category and engine capacity
    let tpValue = new Prisma.Decimal('2094.00'); // default 1yr < 1000cc
    if (vehicleCategory.includes('3YR_MANDATORY_TP') || vehicleCategory === 'PRIVATE_CAR_3YR_MANDATORY_TP') {
      if (cubicCapacity <= 1000) tpValue = new Prisma.Decimal('6521.00');
      else if (cubicCapacity <= 1500) tpValue = new Prisma.Decimal('10640.00');
      else tpValue = new Prisma.Decimal('24596.00');
    } else if (vehicleCategory.includes('5YR_MANDATORY_TP') || vehicleCategory === 'TWO_WHEELER_5YR_MANDATORY_TP') {
      if (cubicCapacity <= 75) tpValue = new Prisma.Decimal('2901.00');
      else if (cubicCapacity <= 150) tpValue = new Prisma.Decimal('3851.00');
      else if (cubicCapacity <= 350) tpValue = new Prisma.Decimal('7365.00');
      else tpValue = new Prisma.Decimal('15117.00');
    } else if (cubicCapacity > 1500) {
      tpValue = new Prisma.Decimal('7897.00');
    } else if (cubicCapacity > 1000) {
      tpValue = new Prisma.Decimal('3416.00');
    }
    const netThirdPartyPremium = tpValue;

    // Segregated tax ledgers (18% GST)
    const gstRate = new Prisma.Decimal('0.18');
    const ownDamageTaxGst = netOwnDamagePremium.mul(gstRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
    const thirdPartyTaxGst = netThirdPartyPremium.mul(gstRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
    const totalTaxGst = ownDamageTaxGst.add(thirdPartyTaxGst);

    const netCustomerPayablePremium = netOwnDamagePremium.add(netThirdPartyPremium).add(totalTaxGst);

    return {
      insuredDeclaredValue,
      netOwnDamagePremium,
      netThirdPartyPremium,
      ownDamageTaxGst,
      thirdPartyTaxGst,
      totalTaxGst,
      netCustomerPayablePremium,
    };
  }
}
