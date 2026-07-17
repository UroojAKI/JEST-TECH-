import { Injectable } from '@nestjs/common';

@Injectable()
export class AddonsService {
  /**
   * Sums the premium cost of all selected optional riders.
   */
  calculateAddonsTotal(addons: { premium: number }[]): number {
    const total = addons.reduce((sum, addon) => sum + addon.premium, 0);
    return Math.round(total * 100) / 100;
  }
}
