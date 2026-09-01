import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

const round2 = (num: number): number =>
  Math.round((num + Number.EPSILON) * 100) / 100;

@Injectable()
export class MotorCalculationService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(input: MotorCalculationInputDto) {
    // 1. Validation Rules
    this.validateInputs(input);

    // 2. Resolve TP Tenure
    const tpTenure = this.resolveTpTenure(input);

    // 3. Resolve NCB (reset to 0 if claim in expiring policy)
    const effectiveNcb = input.claimInExpiringPolicy
      ? 0
      : input.ncbPercent || 0;

    // 4. Fetch Rates based on vehicle specs (Zone, CC, Category)
    const rates = await this.fetchRates(input);

    // 5. Calculate Own Damage (OD)
    let baseOdPremium = 0;
    let ncbDiscountAmount = 0;
    let specialDiscountAmount = 0;
    let addonPremium = 0;
    const itemizedAddons: Array<{
      addonCode: string;
      name: string;
      amount: number;
    }> = [];

    if (['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      if (!input.idv)
        throw new BadRequestException('IDV is required for OD calculation');

      const minIdv = 10000;
      const maxIdv = 50000000;
      if (input.idv < minIdv || input.idv > maxIdv) {
        throw new BadRequestException(
          `IDV must be between ₹${minIdv.toLocaleString('en-IN')} and ₹${maxIdv.toLocaleString('en-IN')}`,
        );
      }

      baseOdPremium = round2(input.idv * (rates.odRate / 100));

      // NCB Discount on OD Base
      ncbDiscountAmount = round2(baseOdPremium * (effectiveNcb / 100));
      const odAfterNcb = Math.max(0, baseOdPremium - ncbDiscountAmount);

      // Special Discount % on OD (Excluding tax)
      const specialDiscountPercent = input.discountPercent || 0;
      specialDiscountAmount = round2(
        odAfterNcb * (specialDiscountPercent / 100),
      );

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
          } else if (
            addon.addonCode === 'RTI' ||
            addon.addonCode === 'RETURN_TO_INVOICE'
          ) {
            price = round2(input.idv * 0.005); // 0.5% of IDV
          } else if (
            addon.addonCode === 'RSA' ||
            addon.addonCode === 'ROADSIDE_ASSISTANCE'
          ) {
            price = 499;
          } else if (addon.addonCode === 'KEY_REPLACEMENT') {
            price = 350;
          } else if (addon.addonCode === 'CONSUMABLES') {
            price = round2(input.idv * 0.002);
          } else if (addon.addonCode === 'TYRE_SECURE') {
            price = 550;
          }
        }

        // G018: Zero-premium addon prevention
        if (price <= 0) {
          throw new BadRequestException(
            `Selected add-on "${addon.addonCode}" has zero or negative calculated premium (₹${price}). Zero-premium add-ons are prohibited per IRDAI compliance. Please provide a valid rate or deselect this add-on.`,
          );
        }

        addonPremium += price;
        itemizedAddons.push({
          addonCode: addon.addonCode,
          name: addon.addonCode.replace(/_/g, ' '),
          amount: price,
        });
      }
    }

    const netOdAfterDiscount = Math.max(
      0,
      baseOdPremium - ncbDiscountAmount - specialDiscountAmount,
    );
    const netOdPremium = round2(netOdAfterDiscount + addonPremium);

    // 6. Calculate Third Party (TP)
    let baseTpPremium = 0;
    let paPremium = 0;
    let paidDriverPremium = 0;

    if (
      ['THIRD_PARTY_ONLY', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)
    ) {
      baseTpPremium = round2(rates.tpRate * tpTenure);
      if (input.paCover !== false) paPremium = round2(rates.paRate);
      if (input.paidDriverLiability)
        paidDriverPremium = round2(rates.paidDriverRate);
    }

    const netTpPremium = round2(baseTpPremium + paPremium + paidDriverPremium);

    // 7. Pre-Tax / Base & Net Premiums
    const grossBasePremium = round2(
      baseOdPremium +
        addonPremium +
        baseTpPremium +
        paPremium +
        paidDriverPremium,
    );
    const totalDiscountAmount = round2(
      ncbDiscountAmount + specialDiscountAmount,
    );
    const netCustomerPremium = round2(
      Math.max(0, baseOdPremium - ncbDiscountAmount - specialDiscountAmount) +
        addonPremium +
        baseTpPremium +
        paPremium +
        paidDriverPremium,
    );

    // 8. Calculate Statutory GST (Option A: Strictly on GROSS pre-tax premium; discounts NEVER reduce tax)
    let gstRate = 0.18;
    if (
      input.vehicleCategory === 'GCV' &&
      input.vehicleSubType === 'GOODS_CARRIAGE'
    ) {
      gstRate = 0.12;
    }

    const totalGst = round2(grossBasePremium * gstRate);
    const cgst = round2(totalGst / 2);
    const sgst = round2(totalGst - cgst);

    // 9. Final Total Payable Amount (Option A: Net Customer Premium + Total Statutory GST)
    const finalPayableAmount = round2(netCustomerPremium + totalGst);

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
        netCustomerPremium,
        netPreTaxPremium: netCustomerPremium,
        basePremium: netCustomerPremium,

        // Tax Breakdown
        gstRate: gstRate * 100,
        cgst,
        sgst,
        totalGst,
        gstAmount: totalGst,

        // Final Payable
        totalPremium: finalPayableAmount,
        finalPayableAmount,
      },
      calculationVersion: 'motor-v3-option-a',
      rateConfigurationVersion: 1,
    };
  }

  private validateInputs(input: MotorCalculationInputDto) {
    if (input.policyType === 'STANDALONE_OD') {
      if (!input.activeTpPolicyNumber || !input.activeTpExpiryDate) {
        throw new BadRequestException(
          'Active TP Policy details are required for Standalone OD policies',
        );
      }
      if (new Date(input.activeTpExpiryDate) <= new Date()) {
        throw new BadRequestException(
          'Active TP Policy has expired, cannot issue SAOD',
        );
      }
    }

    if (input.discountPercent !== undefined && input.discountPercent > 0) {
      const standardLimit = 20;
      const absoluteLimit = 50;
      if (input.discountPercent > absoluteLimit) {
        throw new BadRequestException(
          `Requested discount (${input.discountPercent}%) exceeds absolute statutory ceiling of ${absoluteLimit}%. Disallowed.`,
        );
      }
      if (input.discountPercent > standardLimit && !input.approvalReference) {
        throw new BadRequestException(
          `Requested discount (${input.discountPercent}%) exceeds standard authority limit (${standardLimit}%). An approved escalation approvalReference UUID is required.`,
        );
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
