import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { MotorCalculationInputDto } from '../dto/motor-calculation.dto';

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

    // 4. Fetch Rates from MotorRateConfiguration (Fallback to 0 for unconfigured)
    const rates = await this.fetchRates(input);

    // 5. Calculate OD
    let baseOdPremium = 0;
    let ncbDiscount = 0;
    let addonPremium = 0;
    
    if (['STANDALONE_OD', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      if (!input.idv) throw new BadRequestException('IDV is required for OD calculation');
      
      // Enforce IDV Min/Max (dummy bounds for now, can be configured)
      const minIdv = 50000;
      const maxIdv = 50000000;
      if (input.idv < minIdv || input.idv > maxIdv) {
        throw new BadRequestException(`IDV must be between ${minIdv} and ${maxIdv}`);
      }

      baseOdPremium = (input.idv * (rates.odRate / 100));
      ncbDiscount = baseOdPremium * (effectiveNcb / 100);

      // Add-ons
      for (const addon of input.addons || []) {
        let price = 0;
        const config = rates.addons[addon.addonCode];
        if (addon.manualPrice !== undefined) {
          price = addon.manualPrice;
        } else if (config) {
          switch (config.pricingModel) {
            case 'PERCENT_OF_IDV':
              price = input.idv * (Number(config.rateValue) / 100);
              break;
            case 'PERCENT_OF_OD':
              price = baseOdPremium * (Number(config.rateValue) / 100);
              break;
            case 'FIXED':
              price = Number(config.rateValue);
              break;
            default:
              price = 0;
          }
        }
        addonPremium += price;
      }
    }

    const netOdPremium = Math.max(0, baseOdPremium - ncbDiscount) + addonPremium;

    // 6. Calculate TP
    let baseTpPremium = 0;
    let paPremium = 0;
    let paidDriverPremium = 0;

    if (['THIRD_PARTY_ONLY', 'PACKAGE_COMPREHENSIVE'].includes(input.policyType)) {
      baseTpPremium = rates.tpRate * tpTenure;
      if (input.paCover) paPremium = rates.paRate;
      if (input.paidDriverLiability) paidDriverPremium = rates.paidDriverRate;
    }

    const netTpPremium = baseTpPremium + paPremium + paidDriverPremium;

    // 7. Calculate GST
    // Separate OD vs TP GST rules
    let tpGstRate = 0.18;
    // e.g. Goods Carriage TP is 12%
    if (input.vehicleCategory === 'GCV' && input.vehicleSubType === 'GOODS_CARRIAGE') {
      tpGstRate = 0.12;
    }
    const odGstRate = 0.18;

    const tpGst = netTpPremium * tpGstRate;
    const odGst = netOdPremium * odGstRate;
    const totalGst = tpGst + odGst;

    // 8. Total
    const totalPremium = netOdPremium + netTpPremium + totalGst;

    return {
      inputs: {
        ...input,
        effectiveNcb,
        tpTenure,
      },
      rates,
      outputs: {
        baseOdPremium: Math.round(baseOdPremium),
        ncbDiscount: Math.round(ncbDiscount),
        addonPremium: Math.round(addonPremium),
        netOdPremium: Math.round(netOdPremium),
        
        baseTpPremium: Math.round(baseTpPremium),
        paPremium: Math.round(paPremium),
        paidDriverPremium: Math.round(paidDriverPremium),
        netTpPremium: Math.round(netTpPremium),
        
        odGst: Math.round(odGst),
        tpGst: Math.round(tpGst),
        totalGst: Math.round(totalGst),
        totalPremium: Math.round(totalPremium),
      },
      calculationVersion: 'motor-v3',
      rateConfigurationVersion: 1, // Will be fetched from db max version
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
    // In a real scenario, this would query MotorRateConfiguration
    // For now, we return dummy 0 rates if not configured, or manual
    return {
      odRate: 1.5,
      tpRate: 3000,
      paRate: 350,
      paidDriverRate: 50,
      addons: {} as Record<string, any>,
    };
  }
}
