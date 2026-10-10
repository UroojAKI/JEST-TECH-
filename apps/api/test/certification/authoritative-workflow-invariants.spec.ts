import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { MotorPaymentTrackingService } from '../../src/modules/motor/services/motor-payment-tracking.service';
import { CommissionEngineService } from '../../src/modules/finance/commission/services/commission-engine/commission-engine.service';
import { MotorPolicyDateService } from '../../src/modules/motor/services/motor-policy-date.service';

describe('Authoritative Workflow Invariants & Financial Correctness Audit', () => {
  // ── INVARIANT 1: Payment & Selected Quotation Alignment (P0) ───────────────
  describe('P0 Invariant: Payment tracking strictly enforces case-selected quotation', () => {
    it('blocks payment verification if quotation is not the case selected winner', async () => {
      const mockPrisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote-unselected',
            companyId: 'company-1',
            status: 'DRAFT',
            totalPremium: '15000',
            case: {
              id: 'case-100',
              selectedQuoteId: 'quote-selected-winner', // Different quote is winner!
            },
          }),
        },
      };

      const paymentService = new MotorPaymentTrackingService(mockPrisma);

      await expect(
        paymentService.recordPayment(
          {
            quotationId: 'quote-unselected',
            status: 'PAID',
            amount: 15000,
            referenceNumber: 'REF-123456',
          },
          'company-1',
        ),
      ).rejects.toThrow(
        /SELECTED_QUOTE_INVARIANT_VIOLATION/,
      );
    });

    it('canProceedToPolicy blocks quotation if it is not the case selected winner', async () => {
      const mockPrisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote-unselected',
            companyId: 'company-1',
            workflowState: 'PAYMENT_DONE',
            issuanceStatus: 'ISSUANCE_PENDING',
            calculationSnapshot: { calculationVersion: 'v1' },
            case: {
              selectedQuoteId: 'quote-winner',
            },
          }),
        },
        motorInspection: { findUnique: jest.fn().mockResolvedValue(null) },
        motorPaymentRecord: {
          findUnique: jest.fn().mockResolvedValue({ status: 'PAID' }),
        },
        motorRuleEvaluation: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      const paymentService = new MotorPaymentTrackingService(mockPrisma);
      const result = await paymentService.canProceedToPolicy('quote-unselected', 'company-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContain('QUOTATION_NOT_CASE_SELECTED_WINNER');
    });
  });

  // ── INVARIANT 2: Commission Engine strictly excludes GST (P1) ──────────────
  describe('P1 Invariant: Commission Engine derives GST-exclusive commission base', () => {
    it('calculates agent and manager commission on net premium excluding GST', async () => {
      // Total: 23600, GST: 3600 => Net commissionable base: 20000
      // Agent percent: 15% => Commission should be 3000 (NOT 3540 on gross!)
      // Override percent: 5% => Override should be 1000 (NOT 1180 on gross!)
      const mockPrisma: any = {
        policy: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'policy-10',
            premiumAmount: new Decimal(23600),
            agentId: 'user-agent-1',
            quotation: {
              totalPremium: new Decimal(23600),
              gstAmount: new Decimal(3600),
            },
          }),
        },
        commissionPlan: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'plan-1',
            isActive: true,
            rules: JSON.stringify({
              agentPercent: 15,
              overrides: [
                {
                  userId: 'user-manager-1',
                  roleTier: 'BRANCH_MANAGER',
                  percent: 5,
                },
              ],
            }),
          }),
        },
        user: {
          findUnique: jest.fn().mockImplementation(({ where }) => ({
            id: where.id,
            status: 'ACTIVE',
          })),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => {
          const tx: any = {
            $executeRaw: jest.fn(),
            commission: {
              findMany: jest.fn().mockResolvedValue([]),
              createMany: jest.fn(),
            },
          };
          await callback(tx);
          // Return captured commissions from createMany call
          return tx.commission.createMany.mock.calls[0][0].data;
        }),
      };

      const commissionEngine = new CommissionEngineService(mockPrisma);

      const commissions = await commissionEngine.accrueCommissions(
        'policy-10',
        'user-agent-1',
        '23600',
        'plan-1',
      );

      expect(commissions).toHaveLength(2);

      // Agent Commission: 20000 * 15% = 3000
      const agentCommission = commissions.find((c: any) => c.userId === 'user-agent-1');
      expect(agentCommission).toBeDefined();
      expect(agentCommission?.amount?.toNumber()).toBe(3000);

      // Manager Override: 20000 * 5% = 1000
      const managerOverride = commissions.find((c: any) => c.userId === 'user-manager-1');
      expect(managerOverride).toBeDefined();
      expect(managerOverride?.amount?.toNumber()).toBe(1000);
    });
  });

  // ── INVARIANT 3: Centralized Policy Date Engine (P1) ────────────────────────
  describe('P1 Invariant: MotorPolicyDateService calculates authoritative tenures', () => {
    const dateService = new MotorPolicyDateService();

    it('enforces 1-year OD and 3-year TP tenure for new private cars', () => {
      const dates = dateService.calculateMotorDates({
        vehicleStatus: 'NEW',
        vehicleCategory: 'PRIVATE_CAR',
        policyType: 'PACKAGE_COMPREHENSIVE',
        requestedStartDate: '2026-10-15',
      });

      expect(dates.effectiveStartDate).toBe('2026-10-15');
      // OD: 1 year minus 1 day
      expect(dates.odStartDate).toBe('2026-10-15');
      expect(dates.odEndDate).toBe('2027-10-14');
      // TP: 3 years minus 1 day
      expect(dates.tpStartDate).toBe('2026-10-15');
      expect(dates.tpEndDate).toBe('2029-10-14');
      // Effective end date is TP end date (maximum coverage duration)
      expect(dates.effectiveEndDate).toBe('2029-10-14');
    });

    it('enforces 1-year OD and 5-year TP tenure for new two-wheelers (BIKE)', () => {
      const dates = dateService.calculateMotorDates({
        vehicleStatus: 'NEW',
        vehicleCategory: 'BIKE',
        policyType: 'PACKAGE_COMPREHENSIVE',
        requestedStartDate: '2026-10-15',
      });

      expect(dates.odEndDate).toBe('2027-10-14');
      expect(dates.tpEndDate).toBe('2031-10-14');
      expect(dates.effectiveEndDate).toBe('2031-10-14');
    });

    it('handles continuous renewal starting the day after previous expiry', () => {
      // If previous policy expires in future, renewal starts the next day
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const prevExpiry = dateService.toBusinessDate(futureDate);

      const dates = dateService.calculateMotorDates({
        vehicleStatus: 'EXISTING',
        policyType: 'PACKAGE_COMPREHENSIVE',
        previousExpiryDate: prevExpiry,
      });

      const expectedStart = dateService.addDays(prevExpiry, 1);
      expect(dates.effectiveStartDate).toBe(expectedStart);
      expect(dates.odEndDate).toBe(dateService.addYearsMinusOneDay(expectedStart, 1));
    });
  });
});
