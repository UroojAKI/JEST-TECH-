import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { MotorPaymentTrackingService } from '../../src/modules/motor/services/motor-payment-tracking.service';
import { CommissionEngineService } from '../../src/modules/finance/commission/services/commission-engine/commission-engine.service';
import { MotorPolicyDateService } from '../../src/modules/motor/services/motor-policy-date.service';
import { RenewPolicyService } from '../../src/modules/policies/services/commands/renew-policy.service';
import { CancelPolicyService } from '../../src/modules/policies/services/commands/cancel-policy.service';
import { MotorPolicyIssuanceService } from '../../src/modules/motor/services/motor-policy-issuance.service';

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

  // ── INVARIANT 4: SEC-01 & SEC-02 Policy Renewal & Cancellation Scoping (P0) ─
  describe('P0 Invariant: SEC-01 & SEC-02 Renewal and Cancellation Tenant Scoping', () => {
    it('SEC-01: rejects policy renewal if actor is from a different company', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn().mockImplementation(async (cb) => {
          const tx: any = {
            policy: {
              findFirst: jest.fn().mockImplementation(async ({ where }) => {
                // If companyId is checked, policy in company-b cannot be found by company-a actor
                if (where.companyId === 'company-a') return null;
                return { id: 'policy-b', companyId: 'company-b', status: 'ACTIVE' };
              }),
            },
          };
          return cb(tx);
        }),
      };

      const renewService = new RenewPolicyService(
        {} as any,
        {} as any,
        mockPrisma,
        {} as any,
      );

      await expect(
        renewService.execute(
          'policy-b',
          { renewalNumber: 1, premiumAmount: 10000, newExpiry: '2027-10-10' },
          'user-1',
          { role: 'ADMIN', companyId: 'company-a' },
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('SEC-02: rejects policy cancellation for ADMIN from a different company', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn().mockImplementation(async (cb) => {
          const tx: any = {
            policy: {
              findFirst: jest.fn().mockImplementation(async ({ where }) => {
                // Admin from company-a must NOT match policy in company-b
                if (where.companyId === 'company-a') return null;
                return { id: 'policy-b', companyId: 'company-b', status: 'ACTIVE' };
              }),
            },
          };
          return cb(tx);
        }),
      };

      const cancelService = new CancelPolicyService(
        {} as any,
        {} as any,
        mockPrisma,
      );

      await expect(
        cancelService.execute(
          'policy-b',
          'Customer requested cancellation',
          'admin-a',
          { role: 'ADMIN', companyId: 'company-a' },
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── INVARIANT 5: SEC-04 Payment Role Fail-Closed Verification (P0) ──────────
  describe('P0 Invariant: SEC-04 Fail-Closed Payment Verification Role Guard', () => {
    it('rejects PAID status if actor role is not Finance/Admin even if client sends recordedByRole', async () => {
      const mockPrisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote-1',
            companyId: 'company-1',
            status: 'ACCEPTED',
            totalPremium: '10000',
            case: { selectedQuoteId: 'quote-1' },
          }),
        },
        motorPaymentRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      const paymentService = new MotorPaymentTrackingService(mockPrisma);

      // Caller is an AGENT trying to verify payment by passing recordedByRole: 'ADMIN'
      await expect(
        paymentService.recordPayment(
          {
            quotationId: 'quote-1',
            status: 'PAID',
            amount: 10000,
            referenceNumber: 'UTR-12345',
            recordedByRole: 'ADMIN', // Untrusted forged role in DTO
          },
          'company-1',
          { userId: 'agent-1', role: 'AGENT' } as any, // Trusted server-side actor context
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects PAID status if actor context is completely missing role', async () => {
      const mockPrisma: any = {
        quotation: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'quote-1',
            companyId: 'company-1',
            status: 'ACCEPTED',
            totalPremium: '10000',
            case: { selectedQuoteId: 'quote-1' },
          }),
        },
        motorPaymentRecord: { findUnique: jest.fn().mockResolvedValue(null) },
      };

      const paymentService = new MotorPaymentTrackingService(mockPrisma);

      await expect(
        paymentService.recordPayment(
          {
            quotationId: 'quote-1',
            status: 'PAID',
            amount: 10000,
            referenceNumber: 'UTR-12345',
          },
          'company-1',
          { userId: 'anon' } as any, // No role!
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── INVARIANT 6: SEC-05 Policy Issuance Fail-Closed Company Guard (P0) ─────
  describe('P0 Invariant: SEC-05 Fail-Closed Issuance Cross-Tenant Guard', () => {
    it('rejects issuance when actor companyId does not match quotation companyId', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn().mockImplementation(async (cb) => {
          const tx: any = {
            quotation: {
              findUnique: jest.fn().mockResolvedValue({
                id: 'quote-1',
                companyId: 'company-victim',
                createdById: 'creator-1',
                agentId: 'agent-1',
                totalPremium: '10000',
                case: { selectedQuoteId: 'quote-1' },
              }),
            },
          };
          return cb(tx);
        }),
      };

      const mockAuthz: any = { authorize: jest.fn() };
      const issuanceService = new MotorPolicyIssuanceService(
        mockPrisma,
        {} as any,
        mockAuthz,
        {} as any,
      );

      await expect(
        issuanceService.issuePolicy(
          'quote-1',
          { actualPolicyNumber: 'POL-1' } as any,
          { userId: 'admin-attacker', companyId: 'company-attacker', role: 'ADMIN' } as any,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
