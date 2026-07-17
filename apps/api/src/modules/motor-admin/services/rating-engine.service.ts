import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { RatingRuleType } from '@prisma/client';

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
  }) {
    const {
      variantId,
      insurerId,
      productId,
      vehicleAgeYears = 0,
      ncbPercentage = 0,
      rtoZone = 'ZONE_A',
      selectedAddons = [],
    } = params;

    const variant = await this.prisma.vehicleVariant.findUnique({
      where: { id: variantId },
      include: { model: true },
    });

    if (!variant) {
      throw new NotFoundException('Vehicle variant not found');
    }

    const exShowroom = Number(variant.exShowroomPrice);

    // Calculate IDV based on vehicle age depreciation
    let idvDepreciation = 0.05; // 5% for brand new
    if (vehicleAgeYears === 1) idvDepreciation = 0.15;
    else if (vehicleAgeYears === 2) idvDepreciation = 0.2;
    else if (vehicleAgeYears === 3) idvDepreciation = 0.3;
    else if (vehicleAgeYears === 4) idvDepreciation = 0.4;
    else if (vehicleAgeYears >= 5) idvDepreciation = 0.5;

    const idv = exShowroom * (1 - idvDepreciation);

    const rules = await this.prisma.ratingRule.findMany({
      where: {
        insurerId,
        productId,
        isActive: true,
      },
      orderBy: { priority: 'desc' },
    });

    // Compute Own Damage (OD) Base Premium
    const baseRateRule = rules.find((r) => r.ruleType === RatingRuleType.BASE_RATE);
    let odRate = 0.025; // 2.5% default Own Damage rate
    if (baseRateRule) {
      const rateVal = (baseRateRule.formulaOrRate as any).rate;
      if (rateVal) odRate = Number(rateVal);
    }

    let baseOdPremium = idv * odRate;

    // Apply age loading if rule exists
    const ageRule = rules.find((r) => r.ruleType === RatingRuleType.AGE_LOADING);
    if (ageRule && vehicleAgeYears > 5) {
      const loadingPct = (ageRule.formulaOrRate as any).loadingPct || 0.1;
      baseOdPremium += baseOdPremium * Number(loadingPct);
    }

    // Apply own damage discounts
    const odDiscountRule = rules.find((r) => r.ruleType === RatingRuleType.OD_DISCOUNT);
    let odDiscountFactor = 0;
    if (odDiscountRule) {
      const discount = (odDiscountRule.formulaOrRate as any).discountPct;
      if (discount) odDiscountFactor = Number(discount);
    }
    let odDiscountAmount = baseOdPremium * odDiscountFactor;

    // Apply NCB Discount (on OD premium after basic discounts)
    let ncbDiscountAmount = 0;
    if (ncbPercentage > 0) {
      ncbDiscountAmount = (baseOdPremium - odDiscountAmount) * (ncbPercentage / 100);
    }

    const finalOdPremium = Math.max(baseOdPremium - odDiscountAmount - ncbDiscountAmount, 0);

    // Compute Third Party (TP) Premium based on engine capacity (cc)
    const cc = variant.engineCapacity;
    let tpPremium = 2099;
    if (cc >= 1000 && cc <= 1500) {
      tpPremium = 3416;
    } else if (cc > 1500) {
      tpPremium = 7890;
    }

    // Compute Add-on premiums
    let addonPremium = 0;
    const addonDetails: { name: string; premium: number }[] = [];

    const zeroDepActive = selectedAddons.includes('ZERO_DEP');
    if (zeroDepActive) {
      const zeroDepRate = 0.005; // 0.5% of IDV
      const zeroDepVal = idv * zeroDepRate;
      addonPremium += zeroDepVal;
      addonDetails.push({ name: 'Zero Depreciation Cover', premium: Number(zeroDepVal.toFixed(0)) });
    }

    const engineProtectActive = selectedAddons.includes('ENGINE_PROTECT');
    if (engineProtectActive) {
      const engineRate = 0.0015; // 0.15% of IDV
      const engineVal = idv * engineRate;
      addonPremium += engineVal;
      addonDetails.push({ name: 'Engine Protection Cover', premium: Number(engineVal.toFixed(0)) });
    }

    // Consolidation
    const netPremium = finalOdPremium + tpPremium + addonPremium;
    const taxRate = 0.18; // 18% GST
    const gst = netPremium * taxRate;
    const totalPremium = netPremium + gst;

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
        addons: {
          total: Math.round(addonPremium),
          breakdown: addonDetails,
        },
        netPremium: Math.round(netPremium),
        gst: Math.round(gst),
        totalPremium: Math.round(totalPremium),
      },
    };
  }
}
