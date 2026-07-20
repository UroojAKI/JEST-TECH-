import { Injectable } from '@nestjs/common';

@Injectable()
export class IdvService {
  /**
   * Calculates the Insured Declared Value (IDV) of a vehicle based on
   * ex-showroom price and vehicle age (current year - purchase year).
   *
   * Indian Tariff Depreciation Rules:
   * - Age < 6 months: 5%
   * - Age 6 months to 1 year: 15%
   * - Age 1 to 2 years: 20%
   * - Age 2 to 3 years: 30%
   * - Age 3 to 4 years: 40%
   * - Age 4 to 5 years: 50%
   * - Age > 5 years: 60%
   */
  calculateIdv(exShowroomPrice: number, purchaseYear: number): number {
    const currentYear = new Date().getFullYear();
    const age = Math.max(0, currentYear - purchaseYear);

    let depreciationPercentage = 0.05;

    if (age >= 1 && age < 2) {
      depreciationPercentage = 0.2;
    } else if (age >= 2 && age < 3) {
      depreciationPercentage = 0.3;
    } else if (age >= 3 && age < 4) {
      depreciationPercentage = 0.4;
    } else if (age >= 4 && age <= 5) {
      depreciationPercentage = 0.5;
    } else if (age > 5) {
      depreciationPercentage = 0.6;
    }

    const calculatedIdv = exShowroomPrice * (1 - depreciationPercentage);
    return Math.round(calculatedIdv * 100) / 100;
  }
}
