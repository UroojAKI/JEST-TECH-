import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';

@Injectable()
export class PremiumService {
  /**
   * Calculates Own Damage (OD), Third Party (TP), and PA Cover components.
   */
  calculateMotorPremium(
    coverType: ProductType,
    idv: number,
    engineCc: number,
    rtoZone: 'ZONE_A' | 'ZONE_B' = 'ZONE_A',
    includePaCover = true,
  ): {
    odPremium: number;
    tpPremium: number;
    paCoverPremium: number;
  } {
    let odPremium = 0;
    let tpPremium = 0;
    let paCoverPremium = includePaCover ? 330 : 0;

    // 1. Own Damage (OD) Calculation
    if (coverType === ProductType.PACKAGE_COMPREHENSIVE || coverType === ProductType.STANDALONE_OWN_DAMAGE) {
      const baseOdRate = rtoZone === 'ZONE_A' ? 0.03127 : 0.03082;
      let ccMultiplier = 1.0;
      if (engineCc > 1500) ccMultiplier = 1.3;
      else if (engineCc > 1000) ccMultiplier = 1.15;

      odPremium = Math.round(idv * baseOdRate * ccMultiplier);
    }

    // 2. Third Party (TP) IRDAI Tariff Table Calculation
    if (coverType === ProductType.PACKAGE_COMPREHENSIVE || coverType === ProductType.THIRD_PARTY_ONLY) {
      if (engineCc > 1500) {
        tpPremium = 7897;
      } else if (engineCc > 1000) {
        tpPremium = 3416;
      } else {
        tpPremium = 2094;
      }
    }

    return {
      odPremium,
      tpPremium,
      paCoverPremium,
    };
  }

  /**
   * Computes the base premium based on the product line for generic quotations
   */
  calculateBasePremium(productType: string, sumInsured: number): number {
    let rate = 0.015;
    const type = (productType || '').toUpperCase();

    if (type === 'MOTOR') {
      rate = 0.02;
    } else if (type === 'HEALTH') {
      rate = 0.012;
    } else if (type === 'LIFE') {
      rate = 0.008;
    }

    return Math.round(sumInsured * rate);
  }
}
