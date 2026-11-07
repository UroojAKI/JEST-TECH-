import { Injectable } from '@nestjs/common';

export interface EmiAmortizationMonth {
  month: number;
  openingBalance: number;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
}

@Injectable()
export class LoanCalculationService {
  /**
   * Calculates reducing-balance Equated Monthly Instalment (EMI).
   */
  calculateEmi(
    principal: number,
    annualRatePercentage: number,
    tenureMonths: number,
  ): number {
    if (!principal || principal <= 0 || !tenureMonths || tenureMonths <= 0) {
      return 0;
    }
    if (!annualRatePercentage || annualRatePercentage <= 0) {
      return Math.round((principal / tenureMonths) * 100) / 100;
    }

    const monthlyRate = annualRatePercentage / (12 * 100);
    const compoundFactor = Math.pow(1 + monthlyRate, tenureMonths);
    const emi = (principal * monthlyRate * compoundFactor) / (compoundFactor - 1);
    return Math.round(emi);
  }

  /**
   * Calculates Loan-to-Value (LTV) Ratio as a percentage.
   */
  calculateLtv(loanAmount: number, assetMarketValue: number): number {
    if (!assetMarketValue || assetMarketValue <= 0 || !loanAmount || loanAmount <= 0) {
      return 0;
    }
    const ltv = (loanAmount / assetMarketValue) * 100;
    return Math.round(ltv * 100) / 100;
  }

  /**
   * Calculates Fixed Obligation to Income Ratio (FOIR).
   */
  calculateFoir(
    existingEmi: number,
    proposedEmi: number,
    netMonthlyIncome: number,
  ): number {
    if (!netMonthlyIncome || netMonthlyIncome <= 0) {
      return 0;
    }
    const totalObligations = (existingEmi || 0) + (proposedEmi || 0);
    const foir = (totalObligations / netMonthlyIncome) * 100;
    return Math.round(foir * 100) / 100;
  }

  /**
   * Calculates upfront processing fees and statutory GST (18%).
   */
  calculateTotalCharges(
    processingFee: number,
    otherCharges: number = 0,
    gstRate: number = 0.18,
  ): { baseFee: number; gstAmount: number; totalChargesInclGst: number } {
    const baseFee = Math.max(0, processingFee || 0) + Math.max(0, otherCharges || 0);
    const gstAmount = Math.round(baseFee * gstRate);
    const totalChargesInclGst = baseFee + gstAmount;
    return {
      baseFee,
      gstAmount,
      totalChargesInclGst,
    };
  }

  /**
   * Calculates gross and net commission / brokerage.
   */
  calculateCommission(
    offeredAmount: number,
    commissionRatePercentage?: number,
    customerDiscountAmount?: number,
  ): {
    grossCommissionAmount: number;
    customerDiscountAmount: number;
    netCommissionPayable: number;
  } {
    const rate = commissionRatePercentage || 0;
    const grossCommissionAmount = Math.round((offeredAmount * rate) / 100);
    const discount = Math.max(0, customerDiscountAmount || 0);
    const netCommissionPayable = Math.max(0, grossCommissionAmount - discount);
    return {
      grossCommissionAmount,
      customerDiscountAmount: discount,
      netCommissionPayable,
    };
  }
}

