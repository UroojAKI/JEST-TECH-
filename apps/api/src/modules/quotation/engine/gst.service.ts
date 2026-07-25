import { Injectable } from '@nestjs/common';

@Injectable()
export class GstService {
  private readonly GST_RATE = 0.18; // 18% IRDAI / GST Tax Rate

  /**
   * Calculates CGST (9%), SGST (9%), Total GST (18%) and Final Payable Premium.
   */
  calculateTax(taxableNetPremium: number): {
    taxableNetPremium: number;
    cgst: number;
    sgst: number;
    totalGst: number;
    finalTotalPremium: number;
  } {
    const totalGst = Math.round(taxableNetPremium * this.GST_RATE);
    const cgst = Math.round(totalGst / 2);
    const sgst = totalGst - cgst;
    const finalTotalPremium = taxableNetPremium + totalGst;

    return {
      taxableNetPremium,
      cgst,
      sgst,
      totalGst,
      finalTotalPremium,
    };
  }

  /**
   * Applies standard 18% GST rate on net premium
   */
  calculateGst(premiumAfterDiscount: number): number {
    return Math.round(premiumAfterDiscount * this.GST_RATE);
  }
}
