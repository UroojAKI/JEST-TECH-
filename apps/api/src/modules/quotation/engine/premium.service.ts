import { Injectable } from '@nestjs/common';

@Injectable()
export class PremiumService {
  /**
   * Computes the base premium based on the product line:
   * - MOTOR: 2% of Sum Insured (IDV)
   * - HEALTH: 1.2% of Sum Insured
   * - LIFE: 0.8% of Sum Insured
   * - Default: 1.5% of Sum Insured
   */
  calculateBasePremium(productType: string, sumInsured: number): number {
    let rate = 0.015;
    const type = productType.toUpperCase();

    if (type === 'MOTOR') {
      rate = 0.02;
    } else if (type === 'HEALTH') {
      rate = 0.012;
    } else if (type === 'LIFE') {
      rate = 0.008;
    }

    const basePremium = sumInsured * rate;
    return Math.round(basePremium * 100) / 100;
  }
}
