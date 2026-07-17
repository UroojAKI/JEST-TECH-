import { Injectable } from '@nestjs/common';

@Injectable()
export class DiscountService {
  /**
   * Applies a series of percentage and absolute discounts sequentially.
   */
  applyDiscounts(
    basePremium: number,
    discounts: { percentage?: number; amount?: number }[],
  ): { totalDiscountAmount: number; discountedPremium: number } {
    let currentPremium = basePremium;
    let totalDiscountAmount = 0;

    for (const d of discounts) {
      let applied = 0;
      if (d.percentage) {
        applied = currentPremium * (d.percentage / 100);
      } else if (d.amount) {
        applied = d.amount;
      }

      // Prevent discounts from dropping premium below 0
      applied = Math.min(applied, currentPremium);
      
      currentPremium -= applied;
      totalDiscountAmount += applied;
    }

    return {
      totalDiscountAmount: Math.round(totalDiscountAmount * 100) / 100,
      discountedPremium: Math.round(currentPremium * 100) / 100,
    };
  }
}
