import { Injectable } from '@nestjs/common';

@Injectable()
export class NcbService {
  /**
   * Calculates the No Claim Bonus (NCB) percentage based on prior claim history
   * and consecutive years without claims.
   *
   * Indian Tariff NCB Grid:
   * - 1st year claim-free: 20%
   * - 2nd year claim-free: 25%
   * - 3rd year claim-free: 35%
   * - 4th year claim-free: 45%
   * - 5th year claim-free: 50%
   * - Any claim: 0%
   */
  calculateNcbPercentage(
    yearsWithoutClaim: number,
    claimsCount: number,
  ): number {
    if (claimsCount > 0) {
      return 0;
    }

    if (yearsWithoutClaim <= 0) {
      return 0;
    }

    if (yearsWithoutClaim === 1) {
      return 20;
    } else if (yearsWithoutClaim === 2) {
      return 25;
    } else if (yearsWithoutClaim === 3) {
      return 35;
    } else if (yearsWithoutClaim === 4) {
      return 45;
    } else {
      return 50;
    }
  }
}
