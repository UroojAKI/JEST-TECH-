import { Injectable } from '@nestjs/common';

export const HEALTH_GST_RATE = 0.18;

export interface HealthRiderLine {
  rider: string;
  sumInsured: number;
  premium: number;
}

export interface HealthPremiumInput {
  basePremium: number;
  riders?: HealthRiderLine[];
  commissionPercent?: number;
  /** Defaults to commissionPercent */
  riderCommissionPercent?: number;
}

export interface HealthPremiumBreakdown {
  basePremium: number;
  riderPremium: number;
  netPremium: number;
  gstRate: number;
  gstAmount: number;
  totalPremium: number;
  commissionPercent: number;
  commissionAmount: number;
  netPayable: number;
  riders: {
    lines: HealthRiderLine[];
    riderPremium: number;
    riderGstAmount: number;
    riderTotalPremium: number;
    riderCommissionPercent: number;
    riderCommissionAmount: number;
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Health premium maths from Health_Insurance_CRM_Forms.
 *   Form (i)   field 9   Rider Premium = sum of riders selected in Form (iii)
 *              field 10  Total Premium = (Base + Rider) + 18% GST
 *              field 13  Commission    = (Base + Rider) x D%
 *                        Net payable   = Total - Commission
 *   Form (iii) field 5   Total Rider Premium (incl. GST) = Rider Premium + 18% GST
 *              field 6   Rider Commission = Rider Premium x D%
 * Renewal (Form ii) carries no riders, so rider premium is 0 there.
 * Interpretation of "Sum of ... x D% - <total>" pending business confirmation.
 */
@Injectable()
export class HealthPremiumService {
  calculate(input: HealthPremiumInput): HealthPremiumBreakdown {
    const lines = (input.riders ?? []).map((r) => ({ ...r, premium: round2(r.premium) }));
    const basePremium = round2(input.basePremium);
    const riderPremium = round2(lines.reduce((sum, r) => sum + r.premium, 0));
    const commissionPercent = input.commissionPercent ?? 0;
    const riderCommissionPercent = input.riderCommissionPercent ?? commissionPercent;

    const netPremium = round2(basePremium + riderPremium);
    const gstAmount = round2(netPremium * HEALTH_GST_RATE);
    const totalPremium = round2(netPremium + gstAmount);
    const commissionAmount = round2((netPremium * commissionPercent) / 100);

    const riderGstAmount = round2(riderPremium * HEALTH_GST_RATE);

    return {
      basePremium,
      riderPremium,
      netPremium,
      gstRate: HEALTH_GST_RATE,
      gstAmount,
      totalPremium,
      commissionPercent,
      commissionAmount,
      netPayable: round2(totalPremium - commissionAmount),
      riders: {
        lines,
        riderPremium,
        riderGstAmount,
        riderTotalPremium: round2(riderPremium + riderGstAmount),
        riderCommissionPercent,
        riderCommissionAmount: round2((riderPremium * riderCommissionPercent) / 100),
      },
    };
  }
}
