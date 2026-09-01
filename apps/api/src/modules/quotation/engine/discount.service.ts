import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class DiscountService {
  applyDiscounts(
    basePremium: number,
    discounts: { percentage?: number; amount?: number }[],
  ): { totalDiscountAmount: number; discountedPremium: number } {
    if (!Number.isFinite(basePremium) || basePremium < 0) {
      throw new BadRequestException('Base premium must be a finite non-negative amount');
    }

    let currentPremium = basePremium;
    let totalDiscountAmount = 0;

    for (const discount of discounts || []) {
      const hasPercentage = discount.percentage !== undefined;
      const hasAmount = discount.amount !== undefined;

      if (hasPercentage === hasAmount) {
        throw new BadRequestException('Each discount must specify exactly one of percentage or amount');
      }

      let applied: number;
      if (hasPercentage) {
        const percentage = Number(discount.percentage);
        if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
          throw new BadRequestException('Discount percentage must be between 0 and 100');
        }
        applied = currentPremium * (percentage / 100);
      } else {
        const amount = Number(discount.amount);
        if (!Number.isFinite(amount) || amount < 0) {
          throw new BadRequestException('Discount amount must be a finite non-negative amount');
        }
        applied = amount;
      }

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
