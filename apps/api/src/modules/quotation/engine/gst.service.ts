import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

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

  /**
   * Enterprise Statutory Arbitrary-Precision Segregated Tax Calculation (SDP Volume 2 & 3 Compliance).
   * Segregates Own Damage (OD) vs Third Party (TP) tax ledgers without penny rounding drift.
   * Supports variable GST rates across vehicle categories.
   */
  computeSegregatedTaxDecimal(params: {
    netOwnDamagePremium: Prisma.Decimal;
    netThirdPartyPremium: Prisma.Decimal;
    isInterState?: boolean;
    odGstRate?: number;
    tpGstRate?: number;
  }): {
    odGst: Prisma.Decimal;
    tpGst: Prisma.Decimal;
    totalGst: Prisma.Decimal;
    cgst: Prisma.Decimal;
    sgst: Prisma.Decimal;
    igst: Prisma.Decimal;
    netPayableTotal: Prisma.Decimal;
  } {
    const { 
      netOwnDamagePremium, 
      netThirdPartyPremium, 
      isInterState = false,
      odGstRate = 0.18,
      tpGstRate = 0.18
    } = params;
    
    const odRate = new Prisma.Decimal(odGstRate.toString());
    const tpRate = new Prisma.Decimal(tpGstRate.toString());

    const odGst = netOwnDamagePremium.mul(odRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
    const tpGst = netThirdPartyPremium.mul(tpRate).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
    const totalGst = odGst.add(tpGst);

    let cgst = new Prisma.Decimal(0);
    let sgst = new Prisma.Decimal(0);
    let igst = new Prisma.Decimal(0);

    if (isInterState) {
      igst = totalGst;
    } else {
      // Split each component exactly by 2 instead of blending
      const odCgst = odGst.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
      const tpCgst = tpGst.div(2).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_EVEN);
      cgst = odCgst.add(tpCgst);
      sgst = totalGst.sub(cgst);
    }

    const netPayableTotal = netOwnDamagePremium.add(netThirdPartyPremium).add(totalGst);

    return {
      odGst,
      tpGst,
      totalGst,
      cgst,
      sgst,
      igst,
      netPayableTotal,
    };
  }
}

