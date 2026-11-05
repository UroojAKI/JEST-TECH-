import { BadRequestException } from '@nestjs/common';
import { LifePlanCategory, LifeRiderType } from '@prisma/client';
import { LifeQuotationCalculationService } from './life-quotation-calculation.service';

describe('LifeQuotationCalculationService', () => {
  let service: LifeQuotationCalculationService;

  beforeEach(() => {
    service = new LifeQuotationCalculationService();
  });

  describe('Statutory GST Rate by Category', () => {
    it('applies 18% GST for Pure Term Insurance (Category 1.1)', () => {
      const result = service.calculate({
        planCategory: LifePlanCategory.TERM_INSURANCE,
        basePremium: 20000,
      });

      expect(result.basePlan.gstRate).toBe(18.0);
      expect(result.basePlan.gstAmount).toBe(3600);
      expect(result.basePlan.totalPremium).toBe(23600);
      expect(result.totals.totalPayablePremium).toBe(23600);
    });

    it('applies 1.8% Statutory GST for Annuity single premium (Category 1.7)', () => {
      const result = service.calculate({
        planCategory: LifePlanCategory.ANNUITY,
        basePremium: 1000000, // 10 Lakhs purchase price
      });

      expect(result.basePlan.gstRate).toBe(1.8);
      expect(result.basePlan.gstAmount).toBe(18000);
      expect(result.basePlan.totalPremium).toBe(1018000);
      expect(result.totals.totalPayablePremium).toBe(1018000);
    });

    it('applies standard 18% for Savings Plans (Category 1.2)', () => {
      const result = service.calculate({
        planCategory: LifePlanCategory.SAVINGS_PLANS,
        basePremium: 50000,
      });

      expect(result.basePlan.gstRate).toBe(18.0);
      expect(result.basePlan.gstAmount).toBe(9000);
      expect(result.basePlan.totalPremium).toBe(59000);
    });
  });

  describe('Rider Calculations & No Double Counting', () => {
    it('rolls up multiple riders cleanly without double counting', () => {
      const result = service.calculate({
        planCategory: LifePlanCategory.TERM_INSURANCE,
        basePremium: 15000,
        discountAmount: 1000,
        brokeragePercent: 20,
        riders: [
          {
            riderType: LifeRiderType.ACCIDENTAL_DEATH_BENEFIT,
            riderName: 'Accidental Death Benefit',
            sumAssured: 5000000,
            basePremium: 3000,
            brokeragePercent: 15,
          },
          {
            riderType: LifeRiderType.CRITICAL_ILLNESS_RIDER,
            riderName: 'Comprehensive Critical Illness',
            sumAssured: 2500000,
            basePremium: 5000,
            discountAmount: 500,
            brokeragePercent: 10,
          },
        ],
      });

      // Base Plan: Gross 15,000 - Discount 1,000 = Net 14,000 + 18% GST (2,520) = 16,520
      expect(result.basePlan.netBasePremium).toBe(14000);
      expect(result.basePlan.gstAmount).toBe(2520);
      expect(result.basePlan.totalPremium).toBe(16520);
      expect(result.basePlan.brokerageAmount).toBe(3000); // 15,000 * 20%

      // Rider 1: ADB: Base 3,000 + 18% GST (540) = 3,540. Brokerage = 450 (3,000 * 15%)
      expect(result.riders[0].basePremium).toBe(3000);
      expect(result.riders[0].gstAmount).toBe(540);
      expect(result.riders[0].totalPremium).toBe(3540);
      expect(result.riders[0].brokerageAmount).toBe(450);

      // Rider 2: CI: Gross 5,000 - Discount 500 = Net 4,500 + 18% GST (810) = 5,310. Brokerage = 500 (5,000 * 10%)
      expect(result.riders[1].basePremium).toBe(5000);
      expect(result.riders[1].discountAmount).toBe(500);
      expect(result.riders[1].netBasePremium).toBe(4500);
      expect(result.riders[1].gstAmount).toBe(810);
      expect(result.riders[1].totalPremium).toBe(5310);
      expect(result.riders[1].brokerageAmount).toBe(500);

      // Totals Reconciliation:
      // Gross Base = 15,000 + 3,000 + 5,000 = 23,000
      expect(result.totals.grossBasePremium).toBe(23000);
      // Total Discount = 1,000 + 500 = 1,500
      expect(result.totals.totalCustomerDiscount).toBe(1500);
      // Net Taxable = 23,000 - 1,500 = 21,500
      expect(result.totals.netTaxablePremium).toBe(21500);
      // Total GST = 2,520 + 540 + 810 = 3,870
      expect(result.totals.totalGstAmount).toBe(3870);
      // Customer Payable = 21,500 + 3,870 = 25,370 (Exact sum of baseTotal 16,520 + rider1 3,540 + rider2 5,310)
      expect(result.totals.totalPayablePremium).toBe(25370);
      expect(result.basePlan.totalPremium + result.riders[0].totalPremium + result.riders[1].totalPremium).toBe(25370);

      // Brokerage Total = 3,000 + 450 + 500 = 3,950 (Agency revenue from insurer, NOT deducted from customer payable)
      expect(result.totals.totalBrokerageRevenue).toBe(3950);
    });

    it('confirms brokerage commission is internal revenue and NEVER deducted from customer payable', () => {
      const withBrokerage = service.calculate({
        planCategory: LifePlanCategory.TERM_INSURANCE,
        basePremium: 20000,
        brokeragePercent: 30, // 30% agency brokerage = 6000
      });

      const withoutBrokerage = service.calculate({
        planCategory: LifePlanCategory.TERM_INSURANCE,
        basePremium: 20000,
        brokeragePercent: 0,
      });

      // Customer payable must be IDENTICAL regardless of agent commission!
      expect(withBrokerage.totals.totalPayablePremium).toBe(withoutBrokerage.totals.totalPayablePremium);
      expect(withBrokerage.totals.totalPayablePremium).toBe(23600);
      expect(withBrokerage.totals.totalBrokerageRevenue).toBe(6000);
      expect(withoutBrokerage.totals.totalBrokerageRevenue).toBe(0);
    });
  });

  describe('Validation & Edge Cases', () => {
    it('throws BadRequestException if discount exceeds base premium', () => {
      expect(() =>
        service.calculate({
          planCategory: LifePlanCategory.TERM_INSURANCE,
          basePremium: 10000,
          discountAmount: 12000,
        }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException if rider discount exceeds rider premium', () => {
      expect(() =>
        service.calculate({
          planCategory: LifePlanCategory.TERM_INSURANCE,
          basePremium: 10000,
          riders: [
            {
              riderType: LifeRiderType.ACCIDENTAL_DEATH_BENEFIT,
              riderName: 'ADB',
              sumAssured: 1000000,
              basePremium: 1000,
              discountAmount: 1500,
            },
          ],
        }),
      ).toThrow(BadRequestException);
    });

    it('throws BadRequestException if base premium is negative', () => {
      expect(() =>
        service.calculate({
          planCategory: LifePlanCategory.TERM_INSURANCE,
          basePremium: -500,
        }),
      ).toThrow(BadRequestException);
    });
  });
});

