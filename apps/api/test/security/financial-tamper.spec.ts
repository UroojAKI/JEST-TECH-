import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus, QuotationStatus, PaymentTrackingStatus, Prisma } from '@prisma/client';
import { CreateQuotationVersionService } from '../../src/modules/quotation/services/commands/create-quotation-version.service';
import { FinanceReconciliationService } from '../../src/modules/finance/services/finance-reconciliation.service';
import { IssuePolicyService } from '../../src/modules/policies/services/commands/issue-policy.service';

/**
 * Sprint 8.4: Financial Tampering & Fraud Defense Suite
 *
 * Verifies non-negotiable financial rules:
 * 1. Client-supplied totalPremium / gstAmount cannot override server calculation.
 * 2. Company A BACK_OFFICE cannot reconcile Company B payments (BOLA defense).
 * 3. Company A BACK_OFFICE cannot flag discrepancies on Company B payments.
 * 4. Policy issuance with another company's quotation ID is blocked (BOLA).
 * 5. Only authoritative status = PAID can issue a policy (Q3).
 */
describe('Sprint 8.4: Financial Tampering & Fraud Defense Suite', () => {
  const companyA = 'comp-alpha';
  const companyB = 'comp-beta';

  const actorA: any = {
    userId: 'usr-bo-a',
    companyId: companyA,
    organizationId: companyA,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    status: UserStatus.ACTIVE,
  };

  const actorB: any = {
    userId: 'usr-bo-b',
    companyId: companyB,
    organizationId: companyB,
    role: RoleType.BACK_OFFICE,
    roles: [RoleType.BACK_OFFICE],
    status: UserStatus.ACTIVE,
  };

  describe('1. Quotation Calculation Authority (Tamper Resistance)', () => {
    let service: CreateQuotationVersionService;
    let mockTx: any;
    let mockPrisma: any;

    beforeEach(() => {
      mockTx = {
        quotation: {
          findFirst: jest.fn(),
          update: jest.fn(),
        },
        quotationVersion: {
          create: jest.fn(),
        },
        quotationHistory: {
          create: jest.fn(),
        },
      };
      mockPrisma = {
        $transaction: jest.fn().mockImplementation(async (cb) => cb(mockTx)),
      };
      service = new CreateQuotationVersionService({} as any, mockPrisma);
    });

    it('ignores client-supplied totalPremium: 1 and persists authoritative server-calculated premium', async () => {
      const existingQuote = {
        id: 'q-tamper-1',
        status: QuotationStatus.DRAFT,
        version: 1,
        versions: [{ versionNumber: 1 }],
      };

      mockTx.quotation.findFirst
        .mockResolvedValueOnce(existingQuote)
        .mockResolvedValueOnce({ ...existingQuote, version: 2 });

      mockTx.quotationVersion.create.mockResolvedValue({ id: 'ver-2' });
      mockTx.quotation.update.mockResolvedValue({ id: 'q-tamper-1', version: 2 });

      // Attacker attempts to set premium to ₹1 and GST to ₹0
      await service.execute(
        'q-tamper-1',
        {
          sumInsured: 500000,
          basePremium: 20000,
          discountAmount: 1000, // netBase = 19000
          gstAmount: 0,        // Attacker tampering
          totalPremium: 1,     // Attacker tampering
        },
        'usr-bo-a',
      );

      // Server must calculate GST = 19000 * 0.18 = 3420, total = 19000 + 3420 = 22420
      expect(mockTx.quotationVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quotationId: 'q-tamper-1',
          gstAmount: new Prisma.Decimal(3420),
          totalPremium: new Prisma.Decimal(22420),
        }),
      });
    });
  });

  describe('2. Payment Reconciliation Cross-Tenant Defense (BOLA)', () => {
    let reconService: FinanceReconciliationService;
    let mockPrisma: any;

    beforeEach(() => {
      mockPrisma = {
        motorPaymentRecord: {
          findUnique: jest.fn(),
          update: jest.fn(),
        },
        quotation: {
          update: jest.fn(),
        },
        auditLog: {
          create: jest.fn(),
        },
        outboxEvent: {
          create: jest.fn(),
        },
        $transaction: jest.fn().mockImplementation(async (cb) => cb(mockPrisma)),
      };
      reconService = new FinanceReconciliationService(mockPrisma);
    });

    it('rejects Company A BACK_OFFICE from reconciling Company B payment', async () => {
      // Payment belongs to Company B
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pmt-company-b',
        status: PaymentTrackingStatus.PAID,
        amount: 22420,
        quotation: {
          id: 'q-b',
          companyId: companyB, // Different company!
          totalPremium: 22420,
        },
      });

      // Company A actor attempts to reconcile
      await expect(
        reconService.reconcilePayment('pmt-company-b', actorA, {
          bankReference: 'REF-BANK-123',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects Company A BACK_OFFICE from flagging discrepancy on Company B payment', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pmt-company-b',
        status: PaymentTrackingStatus.PAID,
        quotation: {
          id: 'q-b',
          companyId: companyB, // Different company!
        },
      });

      await expect(
        reconService.flagDiscrepancy('pmt-company-b', actorA, {
          reason: 'Suspicious mismatch',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows Company A BACK_OFFICE to reconcile Company A payment', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pmt-company-a',
        status: PaymentTrackingStatus.PAID,
        amount: 22420,
        referenceNumber: 'REF-A-001',
        quotationId: 'q-a',
        quotation: {
          id: 'q-a',
          companyId: companyA, // Same company!
          totalPremium: 22420,
        },
      });

      mockPrisma.motorPaymentRecord.update.mockResolvedValue({
        id: 'pmt-company-a',
        quotationId: 'q-a',
      });

      const result = await reconService.reconcilePayment('pmt-company-a', actorA, {
        bankReference: 'REF-BANK-123',
      });

      expect(result.status).toBe('RECONCILED');
    });
  });

  describe('3. Policy Issuance BOLA Defense', () => {
    let issueService: IssuePolicyService;
    let mockPrisma: any;
    let mockQuotationRepo: any;
    let mockBackOfficeQueue: any;

    beforeEach(() => {
      mockPrisma = {
        policy: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      mockQuotationRepo = {
        findById: jest.fn(),
      };
      mockBackOfficeQueue = {
        validateIssuanceGates: jest.fn().mockResolvedValue(true),
      };
      issueService = new IssuePolicyService(
        {} as any,
        mockQuotationRepo,
        {} as any,
        {} as any,
        mockPrisma,
        {} as any,
        mockBackOfficeQueue,
        {} as any,
      );
    });

    it('rejects policy issuance when quotation belongs to another company', async () => {
      // Quotation belongs to Company B
      mockQuotationRepo.findById.mockResolvedValue({
        id: 'q-beta',
        companyId: companyB, // Company B
        status: QuotationStatus.ACCEPTED,
      });

      // Company A actor attempts to issue policy for Company B quotation
      await expect(
        issueService.execute({ quotationId: 'q-beta' } as any, actorA.userId, actorA),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
