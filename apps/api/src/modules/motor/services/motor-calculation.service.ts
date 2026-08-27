import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

@Injectable()
export class MotorCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(input: MotorCalculationInputDto) {
    // 1. Validation Rules
    this.validateInputs(input);

    // 2. Resolve TP Tenure
    const tpTenure = this.resolveTpTenure(input);

    // 3. Resolve NCB (reset to 0 if claim in expiring policy)
    const effectiveNcb = input.claimInExpiringPolicy ? 0 : (input.ncbPercent || 0);

    // 4. Fetch Rates based on vehicle specs (Zone, CC, Category)
    const rates = await this.fetchRates(input);

    // 5. Calculate Own Damage (OD)
    let baseOdPremium = 0;
    let ncbDiscountAmount = 0;
    let specialDiscountAmount = 0;
    let addonPremium = 0;
    const itemizedAddons: Array<{ addonCode: string; name: string; amount: number }> = [];

    if (['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      if (!input.idv) throw new BadRequestException('IDV is required for OD calculation');

      const minIdv = 10000;
      const maxIdv = 50000000;
      if (input.idv < minIdv || input.idv > maxIdv) {
        throw new BadRequestException(`IDV must be between ₹${minIdv.toLocaleString('en-IN')} and ₹${maxIdv.toLocaleString('en-IN')}`);
      }

      baseOdPremium = round2(input.idv * (rates.odRate / 100));

      // NCB Discount on OD Base
      ncbDiscountAmount = round2(baseOdPremium * (effectiveNcb / 100));
      const odAfterNcb = Math.max(0, baseOdPremium - ncbDiscountAmount);

      // Special Discount % on OD (Excluding tax)
      const specialDiscountPercent = input.discountPercent || 0;
      specialDiscountAmount = round2(odAfterNcb * (specialDiscountPercent / 100));

      // Add-ons Calculation
      for (const addon of input.addons || []) {
        let price = 0;
        const config = rates.addons[addon.addonCode];
        if (addon.manualPrice !== undefined && addon.manualPrice >= 0) {
          price = round2(addon.manualPrice);
        } else if (config) {
          switch (config.pricingModel) {
            case 'PERCENT_OF_IDV':
              price = round2(input.idv * (Number(config.rateValue) / 100));
              break;
            case 'PERCENT_OF_OD':
              price = round2(baseOdPremium * (Number(config.rateValue) / 100));
              break;
            case 'FIXED':
              price = round2(Number(config.rateValue));
              break;
            default:
              price = 0;
          }
        } else {
          // Standard defaults for well-known add-ons
          if (addon.addonCode === 'ZERO_DEP' || addon.addonCode === 'NIL_DEP') {
            price = round2(input.idv * 0.009); // 0.9% of IDV
          } else if (addon.addonCode === 'ENGINE_PROTECT') {
            price = round2(input.idv * 0.003); // 0.3% of IDV
          } else if (addon.addonCode === 'RTI' || addon.addonCode === 'RETURN_TO_INVOICE') {
            price = round2(input.idv * 0.005); // 0.5% of IDV
          } else if (addon.addonCode === 'RSA' || addon.addonCode === 'ROADSIDE_ASSISTANCE') {
            price = 499;
          } else if (addon.addonCode === 'KEY_REPLACEMENT') {
            price = 350;
          } else if (addon.addonCode === 'CONSUMABLES') {
            price = round2(input.idv * 0.002);
          } else if (addon.addonCode === 'TYRE_SECURE') {
            price = 550;
          }
        }

        addonPremium += price;
        itemizedAddons.push({
          addonCode: addon.addonCode,
          name: addon.addonCode.replace(/_/g, ' '),
          amount: price,
        });
      }
    }

    const netOdAfterDiscount = Math.max(0, baseOdPremium - ncbDiscountAmount - specialDiscountAmount);
    const netOdPremium = round2(netOdAfterDiscount + addonPremium);

    // 6. Calculate Third Party (TP)
    let baseTpPremium = 0;
    let paPremium = 0;
    let paidDriverPremium = 0;

    if (['THIRD_PARTY_ONLY', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      baseTpPremium = round2(rates.tpRate * tpTenure);
      if (input.paCover !== false) paPremium = round2(rates.paRate);
      if (input.paidDriverLiability) paidDriverPremium = round2(rates.paidDriverRate);
    }

    const netTpPremium = round2(baseTpPremium + paPremium + paidDriverPremium);

    // 7. Pre-Tax / Base & Net Premiums
    const grossBasePremium = round2(baseOdPremium + addonPremium + baseTpPremium + paPremium + paidDriverPremium);
    const totalDiscountAmount = round2(ncbDiscountAmount + specialDiscountAmount);
    const netPreTaxPremium = round2(netOdPremium + netTpPremium);

    // 8. Calculate GST (Strictly on pre-tax net amount, post discount)
    let gstRate = 0.18;
    if (input.vehicleCategory === 'GCV' && input.vehicleSubType === 'GOODS_CARRIAGE') {
      gstRate = 0.12;
    }

    const odGst = round2(netOdPremium * gstRate);
    const tpGst = round2(netTpPremium * gstRate);
    const totalGst = round2(netPreTaxPremium * gstRate);

    // 9. Final Total Payable Amount
    const finalPayableAmount = round2(netPreTaxPremium + totalGst);

    return {
      inputs: {
        ...input,
        effectiveNcb,
        tpTenure,
      },
      rates,
      outputs: {
        // Own Damage Breakdown
        baseOdPremium,
        ncbDiscount: ncbDiscountAmount,
        specialDiscount: specialDiscountAmount,
        addonPremium: round2(addonPremium),
        netOdPremium,
        itemizedAddons,

        // Third Party Breakdown
        baseTpPremium,
        paPremium,
        paidDriverPremium,
        netTpPremium,

        // Combined Totals
        grossBasePremium,
        totalDiscount: totalDiscountAmount,
        netPreTaxPremium,
        basePremium: netPreTaxPremium, // Clear pre-tax net amount

        // Tax Breakdown
        gstRate: gstRate * 100,
        odGst,
        tpGst,
        totalGst,
        gstAmount: totalGst,

        // Final Payable
        totalPremium: finalPayableAmount,
        finalPayableAmount,
      },
      calculationVersion: 'motor-v3-irda',
      rateConfigurationVersion: 1,
    };
  }

  private validateInputs(input: MotorCalculationInputDto) {
    if (input.policyType === 'STANDALONE_OD') {
      if (!input.activeTpPolicyNumber || !input.activeTpExpiryDate) {
        throw new BadRequestException('Active TP Policy details are required for Standalone OD policies');
      }
      if (new Date(input.activeTpExpiryDate) <= new Date()) {
        throw new BadRequestException('Active TP Policy has expired, cannot issue SAOD');
      }
    }
  }

  private resolveTpTenure(input: MotorCalculationInputDto): number {
    if (input.vehicleStatus === 'NEW') {
      if (input.vehicleCategory === 'PRIVATE_CAR') return 3;
      if (input.vehicleCategory === 'BIKE') return 5;
    }
    return input.policyTenure || 1;
  }

  private async fetchRates(input: MotorCalculationInputDto) {
    // IRDAI Standard Mandated Tariff Table
    let tpRate = 3416; // Standard 1000-1500cc Private Car
    let odRate = 3.127; // Zone A standard

    if (input.vehicleCategory === 'BIKE') {
      tpRate = 714; // 75-150cc 2W
      odRate = 1.708;
    } else if (input.vehicleCategory === 'GCV') {
      tpRate = 15746;
      odRate = 2.15;
    } else if (input.vehicleCategory === 'PRIVATE_CAR') {
      tpRate = 3416;
      odRate = 3.127;
    }

    return {
      odRate,
      tpRate,
      paRate: 275, // IRDAI 15 Lakhs Owner-Driver PA Cover
      paidDriverRate: 50,
      addons: {} as Record<string, any>,
    };
  }
}
