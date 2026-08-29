import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class IdvService {
  /**
   * Calculates the Insured Declared Value (IDV) based on IRDAI Depreciation Rules.
   * Allows manual override within IRDAI permitted +/- 15% range.
   */
  calculateIdv(
    exShowroomPrice: number,
    registrationYear: number,
    manualOverrideIdv?: number,
  ): {
    calculatedIdv: number;
    recommendedMinIdv: number;
    recommendedMaxIdv: number;
    depreciationPercent: number;
    finalIdv: number;
  } {
    const currentYear = new Date().getFullYear();
    const vehicleAgeYears = Math.max(0, currentYear - registrationYear);

    let depreciationPercent = 5;
    if (vehicleAgeYears === 1) depreciationPercent = 15;
    else if (vehicleAgeYears === 2) depreciationPercent = 20;
    else if (vehicleAgeYears === 3) depreciationPercent = 30;
    else if (vehicleAgeYears === 4) depreciationPercent = 40;
    else if (vehicleAgeYears >= 5) depreciationPercent = 50;

    const calculatedIdv = Math.round(
      exShowroomPrice * (1 - depreciationPercent / 100),
    );
    const recommendedMinIdv = Math.round(calculatedIdv * 0.85);
    const recommendedMaxIdv = Math.round(calculatedIdv * 1.15);

    let finalIdv = calculatedIdv;

    if (manualOverrideIdv !== undefined && manualOverrideIdv > 0) {
      if (
        manualOverrideIdv < recommendedMinIdv ||
        manualOverrideIdv > recommendedMaxIdv
      ) {
        throw new BadRequestException(
          `Manual IDV override ₹${manualOverrideIdv.toLocaleString()} is outside IRDAI allowed boundary (₹${recommendedMinIdv.toLocaleString()} - ₹${recommendedMaxIdv.toLocaleString()})`,
        );
      }
      finalIdv = manualOverrideIdv;
    }

    return {
      calculatedIdv,
      recommendedMinIdv,
      recommendedMaxIdv,
      depreciationPercent,
      finalIdv,
    };
  }
}
