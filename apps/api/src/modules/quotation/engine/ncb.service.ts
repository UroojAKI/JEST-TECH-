import { Injectable } from '@nestjs/common';

@Injectable()
export class NcbService {
  /**
   * IRDAI No Claim Bonus (NCB) Discount Calculator.
   * Tiers: 0%, 20%, 25%, 35%, 45%, 50%.
   * Applied strictly on Own Damage (OD) premium.
   */
  calculateNcbDiscount(
    baseOdPremium: number,
    ncbPercentage: number,
    hadClaimInPreviousYear = false,
  ): {
    applicableNcbPercent: number;
    ncbDiscountAmount: number;
  } {
    if (hadClaimInPreviousYear) {
      return { applicableNcbPercent: 0, ncbDiscountAmount: 0 };
    }

    const validPercentages = [0, 20, 25, 35, 45, 50];
    const applicableNcbPercent = validPercentages.includes(ncbPercentage)
      ? ncbPercentage
      : 0;

    const ncbDiscountAmount = Math.round(baseOdPremium * (applicableNcbPercent / 100));

    return {
      applicableNcbPercent,
      ncbDiscountAmount,
    };
  }
}
