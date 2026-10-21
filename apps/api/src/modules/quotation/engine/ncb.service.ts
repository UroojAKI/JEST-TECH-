import { Injectable, BadRequestException } from '@nestjs/common';

export const VALID_NCB_PERCENTAGES = [0, 20, 25, 35, 45, 50];

@Injectable()
export class NcbService {
  /**
   * IRDAI No Claim Bonus (NCB) Validator.
   * Allowed discrete tiers: 0%, 20%, 25%, 35%, 45%, 50%.
   * In JEST Policy CRM canonical formula, NCB is an underwriting risk/metadata attribute.
   * Unsupported percentages are strictly rejected with BadRequestException.
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

    if (ncbPercentage !== undefined && !VALID_NCB_PERCENTAGES.includes(ncbPercentage)) {
      throw new BadRequestException(
        `Unsupported NCB percentage: ${ncbPercentage}%. Permitted discrete tiers are 0%, 20%, 25%, 35%, 45%, 50%.`,
      );
    }

    return {
      applicableNcbPercent: ncbPercentage || 0,
      ncbDiscountAmount: 0, // Canonical: NCB does not deduct from payable total
    };
  }
}
