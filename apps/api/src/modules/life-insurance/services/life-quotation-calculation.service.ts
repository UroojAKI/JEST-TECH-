import { BadRequestException, Injectable } from '@nestjs/common';
import { LifePlanCategory } from '@prisma/client';
import { LifeRiderInputDto } from '../dto/life-rider.dto';

export interface CalculatedRiderLineItem {
  riderType: string;
  riderName: string;
  sumAssured: number;
  termYears?: number;
  pptYears?: number;
  basePremium: number;
  discountAmount: number;
  netBasePremium: number;
  gstRate: number;
  gstAmount: number;
  totalPremium: number;
  brokeragePercent: number;
  brokerageAmount: number;
  calculationSnapshot: Record<string, any>;
}

export interface LifeQuotationCalculationResult {
  basePlan: {
    basePremium: number;
    discountAmount: number;
    netBasePremium: number;
    gstRate: number;
    gstAmount: number;
    totalPremium: number;
    brokeragePercent: number;
    brokerageAmount: number;
  };
  riders: CalculatedRiderLineItem[];
  totals: {
    grossBasePremium: number;       // Base plan + riders gross
    totalCustomerDiscount: number;   // Total discount given to customer
    netTaxablePremium: number;       // Total gross - total discount
    totalGstAmount: number;          // Total tax payable
    totalPayablePremium: number;     // Authoritative amount customer pays (net + gst)
    totalBrokerageRevenue: number;   // Internal agency revenue from insurer (NEVER deducted from customer)
  };
  calculationSnapshot: Record<string, any>;
}

export interface CalculationInput {
  planCategory: LifePlanCategory;
  basePremium: number;
  discountAmount?: number;
  brokeragePercent?: number;
  riders?: LifeRiderInputDto[];
}

@Injectable()
export class LifeQuotationCalculationService {
  /**
   * Statutory GST rate resolution by IRDAI plan category.
   * Pure term & rider benefits: standard 18.0%.
   * Annuity purchase price: 1.8% statutory rate for single premium annuity.
   * Other savings/endowment: 18.0% standard on risk premium component.
   */
  getStatutoryGstRate(planCategory: LifePlanCategory): number {
    switch (planCategory) {
      case LifePlanCategory.ANNUITY:
        return 1.8; // IRDAI statutory single premium annuity rate
      case LifePlanCategory.TERM_INSURANCE:
      case LifePlanCategory.WHOLE_LIFE:
      case LifePlanCategory.SAVINGS_PLANS:
      case LifePlanCategory.INVESTMENT_PLANS:
      case LifePlanCategory.RETIREMENT_PENSION:
      case LifePlanCategory.CHILD_FUTURE:
      case LifePlanCategory.GROUP_INSURANCE:
      default:
        return 18.0;
    }
  }

  private roundToTwo(val: number): number {
    return Math.round((val + Number.EPSILON) * 100) / 100;
  }

  calculate(input: CalculationInput): LifeQuotationCalculationResult {
    const { planCategory, basePremium, riders = [] } = input;

    if (basePremium < 0) {
      throw new BadRequestException('Base premium cannot be negative');
    }

    const baseDiscount = this.roundToTwo(input.discountAmount || 0);
    if (baseDiscount > basePremium) {
      throw new BadRequestException(
        `Base plan discount (₹${baseDiscount}) cannot exceed base premium (₹${basePremium})`,
      );
    }

    const baseBrokeragePercent = input.brokeragePercent || 0;
    if (baseBrokeragePercent < 0 || baseBrokeragePercent > 100) {
      throw new BadRequestException('Brokerage percent must be between 0 and 100');
    }

    // 1. Base Plan Calculation
    const netBasePremium = this.roundToTwo(basePremium - baseDiscount);
    const baseGstRate = this.getStatutoryGstRate(planCategory);
    const baseGstAmount = this.roundToTwo((netBasePremium * baseGstRate) / 100);
    const baseTotalPremium = this.roundToTwo(netBasePremium + baseGstAmount);
    const baseBrokerageAmount = this.roundToTwo((basePremium * baseBrokeragePercent) / 100);

    // 2. Riders Calculation (Line-Item Independence)
    let ridersGrossBaseSum = 0;
    let ridersDiscountSum = 0;
    let ridersGstSum = 0;
    let ridersBrokerageSum = 0;

    const calculatedRiders: CalculatedRiderLineItem[] = [];

    for (const r of riders) {
      const rBase = this.roundToTwo(r.basePremium);
      if (rBase < 0) {
        throw new BadRequestException(`Rider '${r.riderName}' base premium cannot be negative`);
      }

      const rDiscount = this.roundToTwo(r.discountAmount || 0);
      if (rDiscount > rBase) {
        throw new BadRequestException(
          `Rider '${r.riderName}' discount (₹${rDiscount}) cannot exceed rider premium (₹${rBase})`,
        );
      }

      const rNet = this.roundToTwo(rBase - rDiscount);
      // Riders are pure risk protection add-ons; standard statutory GST is 18.0%
      const rGstRate = 18.0;
      const rGst = this.roundToTwo((rNet * rGstRate) / 100);
      const rTotal = this.roundToTwo(rNet + rGst);

      const rBrokeragePercent = r.brokeragePercent || 0;
      if (rBrokeragePercent < 0 || rBrokeragePercent > 100) {
        throw new BadRequestException(`Rider '${r.riderName}' brokerage percent must be between 0 and 100`);
      }
      const rBrokerageAmount = this.roundToTwo((rBase * rBrokeragePercent) / 100);

      ridersGrossBaseSum = this.roundToTwo(ridersGrossBaseSum + rBase);
      ridersDiscountSum = this.roundToTwo(ridersDiscountSum + rDiscount);
      ridersGstSum = this.roundToTwo(ridersGstSum + rGst);
      ridersBrokerageSum = this.roundToTwo(ridersBrokerageSum + rBrokerageAmount);

      calculatedRiders.push({
        riderType: r.riderType,
        riderName: r.riderName,
        sumAssured: r.sumAssured,
        termYears: r.termYears,
        pptYears: r.pptYears,
        basePremium: rBase,
        discountAmount: rDiscount,
        netBasePremium: rNet,
        gstRate: rGstRate,
        gstAmount: rGst,
        totalPremium: rTotal,
        brokeragePercent: rBrokeragePercent,
        brokerageAmount: rBrokerageAmount,
        calculationSnapshot: {
          calculationTimestamp: new Date().toISOString(),
          formula: 'total = (base - discount) * (1 + gstRate/100)',
          brokerageFormula: 'brokerage = base * (brokeragePercent/100)',
          ...r.calculationSnapshot,
        },
      });
    }

    // 3. Roll-up Totals (Authoritative Reconciliation)
    const grossBasePremium = this.roundToTwo(basePremium + ridersGrossBaseSum);
    const totalCustomerDiscount = this.roundToTwo(baseDiscount + ridersDiscountSum);
    const netTaxablePremium = this.roundToTwo(grossBasePremium - totalCustomerDiscount);
    const totalGstAmount = this.roundToTwo(baseGstAmount + ridersGstSum);
    const totalPayablePremium = this.roundToTwo(netTaxablePremium + totalGstAmount);
    const totalBrokerageRevenue = this.roundToTwo(baseBrokerageAmount + ridersBrokerageSum);

    const calculationSnapshot = {
      planCategory,
      calculatedAt: new Date().toISOString(),
      formulaRules: {
        customerPayable: 'netTaxablePremium + totalGstAmount',
        netTaxablePremium: 'grossBasePremium - totalCustomerDiscount',
        brokerageRule: 'Brokerage is agency revenue paid by insurer; not deducted from customer payable',
      },
      basePlan: {
        basePremium,
        discountAmount: baseDiscount,
        netBasePremium,
        gstRate: baseGstRate,
        gstAmount: baseGstAmount,
        totalPremium: baseTotalPremium,
        brokeragePercent: baseBrokeragePercent,
        brokerageAmount: baseBrokerageAmount,
      },
      ridersSummary: {
        count: calculatedRiders.length,
        grossBasePremium: ridersGrossBaseSum,
        totalDiscount: ridersDiscountSum,
        totalGst: ridersGstSum,
        totalBrokerage: ridersBrokerageSum,
      },
      totals: {
        grossBasePremium,
        totalCustomerDiscount,
        netTaxablePremium,
        totalGstAmount,
        totalPayablePremium,
        totalBrokerageRevenue,
      },
    };

    return {
      basePlan: {
        basePremium,
        discountAmount: baseDiscount,
        netBasePremium,
        gstRate: baseGstRate,
        gstAmount: baseGstAmount,
        totalPremium: baseTotalPremium,
        brokeragePercent: baseBrokeragePercent,
        brokerageAmount: baseBrokerageAmount,
      },
      riders: calculatedRiders,
      totals: {
        grossBasePremium,
        totalCustomerDiscount,
        netTaxablePremium,
        totalGstAmount,
        totalPayablePremium,
        totalBrokerageRevenue,
      },
      calculationSnapshot,
    };
  }
}

