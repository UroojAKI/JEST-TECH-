import { Test, TestingModule } from '@nestjs/testing';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';

describe('MotorPaymentTrackingService & Reconciliation (Iteration 7)', () => {
  let service: MotorPaymentTrackingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(async (cb) =>
        typeof cb === 'function' ? cb(prisma) : Promise.all(cb),
      ),
      quotation: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      motorPaymentRecord: {
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      motorInspection: {
        findUnique: jest.fn(),
      },
      motorRuleEvaluation: {
        findUnique: jest.fn(),
      },
      proposal: {
        findUnique: jest.fn(),
      },
      motorQuotationCase: {
        update: jest.fn(),
      },
      idempotencyKey: {
        findFirst: jest.fn(),
        upsert: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorPaymentTrackingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<MotorPaymentTrackingService>(
      MotorPaymentTrackingService,
    );
  });

  describe('recordPayment', () => {
    const mockQuote = {
      id: 'q-10',
      totalPremium: 17638.88,
      workflowState: 'QUOTATION_DRAFT',
      issuanceStatus: 'PAYMENT_PENDING',
    };

    it('should successfully record payment and transition to ISSUANCE_PENDING on exact amount', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'pay-1',
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-BANK-999',
      });

      const result = await service.recordPayment({
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-BANK-999',
        paymentMethod: 'UPI',
      });

      expect(result).toBeDefined();
      expect(prisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-10' },
        data: expect.objectContaining({
          workflowState: 'PAYMENT_DONE',
          issuanceStatus: 'ISSUANCE_PENDING',
        }),
      });
    });

    it('should reject underpayment when paid amount is less than total premium', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPayment({
          quotationId: 'q-10',
          status: 'PAID',
          amount: 5000, // Underpayment (required: 17638.88)
          referenceNumber: 'REF-CHEQUE-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject overpayment when paid amount exceeds total premium', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuote);
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPayment({
          quotationId: 'q-10',
          status: 'PAID',
          amount: 20000, // Overpayment (required: 17638.88)
          referenceNumber: 'REF-OVERPAY-123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject payment if inspection is required and not completed', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        workflowState: 'INSPECTION_REQUIRED',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({
        inspectionRequired: true,
      });
      prisma.motorInspection.findUnique.mockResolvedValue({
        status: 'IN_PROGRESS',
      });

      await expect(
        service.recordPayment({
          quotationId: 'q-10',
          status: 'PAID',
          amount: 17638.88,
          referenceNumber: 'REF-PAID-001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should return existing payment idempotently when same reference is re-submitted', async () => {
      prisma.quotation.findUnique.mockResolvedValue(mockQuote);
      const existingPaid = {
        id: 'pay-1',
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-BANK-999',
      };
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(existingPaid);

      const result = await service.recordPayment({
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-BANK-999',
      });

      expect(result).toEqual(existingPaid);
      expect(prisma.motorPaymentRecord.upsert).not.toHaveBeenCalled();
    });

    it('PHASE 13: should reject with HTTP 409 ConflictException on idempotency key reuse with different payload', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        companyId: 'comp-1',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.idempotencyKey.findFirst.mockResolvedValue({
        id: 'idem-1',
        companyId: 'comp-1',
        actorId: 'user-1',
        operationType: 'MOTOR_PAYMENT',
        idempotencyKey: 'key-12345',
        requestHash: 'different-hash',
        status: 'SUCCEEDED',
      });

      await expect(
        service.recordPayment({
          quotationId: 'q-10',
          status: 'PAID',
          amount: 17638.88,
          referenceNumber: 'REF-BANK-999',
          idempotencyKey: 'key-12345',
          recordedById: 'user-1',
        }),
      ).rejects.toThrow('IDEMPOTENCY_KEY_REUSE_MISMATCH');
    });

    it('PHASE 13: should return cached payload on duplicate idempotency key with identical payload', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        companyId: 'comp-1',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);

      // Compute identical hash
      const crypto = require('crypto');
      const hash = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            quotationId: 'q-10',
            amount: 17638.88,
            referenceNumber: 'REF-BANK-999',
            status: 'PAID',
          }),
        )
        .digest('hex');

      const cachedResponse = {
        id: 'pay-cached',
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
      };

      prisma.idempotencyKey.findFirst.mockResolvedValue({
        id: 'idem-1',
        companyId: 'comp-1',
        actorId: 'user-1',
        operationType: 'MOTOR_PAYMENT',
        idempotencyKey: 'key-12345',
        requestHash: hash,
        status: 'SUCCEEDED',
        responsePayload: cachedResponse,
      });

      const result = await service.recordPayment({
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-BANK-999',
        idempotencyKey: 'key-12345',
        recordedById: 'user-1',
      });

      expect(result).toEqual(cachedResponse);
      expect(prisma.motorPaymentRecord.upsert).not.toHaveBeenCalled();
    });

    it('PAY-002: should reject cross-organization payment attempt with ForbiddenException', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        companyId: 'org-tenant-A',
      });

      await expect(
        service.recordPayment(
          {
            quotationId: 'q-10',
            status: 'PAID',
            amount: 17638.88,
            referenceNumber: 'REF-BANK-999',
          },
          'org-tenant-B',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('PAY-002: should prohibit Sales Agents from marking payment as PAID', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        companyId: 'org-1',
        createdById: 'agent-1',
      });

      const agentActor: any = {
        userId: 'agent-1',
        role: RoleType.AGENT,
        roles: [RoleType.AGENT],
        companyId: 'org-1',
      };

      await expect(
        service.recordPayment(
          {
            quotationId: 'q-10',
            status: 'PAID',
            amount: 17638.88,
            referenceNumber: 'REF-BANK-999',
          },
          'org-1',
          agentActor,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('PAY-002: should block PAID payment when proposal is not approved', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        productType: 'MOTOR',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.proposal.findUnique.mockResolvedValue({
        id: 'prop-1',
        status: 'SUBMITTED',
      });

      await expect(
        service.recordPayment({
          quotationId: 'q-10',
          status: 'PAID',
          amount: 17638.88,
          referenceNumber: 'REF-BANK-999',
        }),
      ).rejects.toThrow('Proposal has not been approved yet');
    });

    it('PAY-002: should permit payment when inspection is WAIVED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        workflowState: 'INSPECTION_REQUIRED',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({
        inspectionRequired: true,
      });
      prisma.motorInspection.findUnique.mockResolvedValue({
        status: 'WAIVED',
      });
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'pay-waived',
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
      });

      const result = await service.recordPayment({
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-WAIVED-001',
      });

      expect(result).toBeDefined();
      expect(prisma.motorPaymentRecord.upsert).toHaveBeenCalled();
    });

    it('PAY-002: should update linked quotation case to PAYMENT_VERIFIED on PAID payment', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        ...mockQuote,
        caseId: 'case-motor-1',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);
      prisma.motorPaymentRecord.upsert.mockResolvedValue({
        id: 'pay-case-1',
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
      });

      await service.recordPayment({
        quotationId: 'q-10',
        status: 'PAID',
        amount: 17638.88,
        referenceNumber: 'REF-CASE-001',
      });

      expect(prisma.motorQuotationCase.update).toHaveBeenCalledWith({
        where: { id: 'case-motor-1' },
        data: { status: 'PAYMENT_VERIFIED' },
      });
    });
  });

  describe('canProceedToPolicy', () => {
    it('should allow policy creation when payment is PAID and inspection is APPROVED', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-10',
        calculationSnapshot: { some: 'data' },
        issuanceStatus: 'ISSUANCE_PENDING',
        workflowState: 'PAYMENT_DONE',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue({
        status: 'PAID',
      });
      prisma.motorRuleEvaluation.findUnique.mockResolvedValue({
        inspectionRequired: true,
      });
      prisma.motorInspection.findUnique.mockResolvedValue({
        status: 'COMPLETED',
      });

      const readiness = await service.canProceedToPolicy('q-10');
      expect(readiness.allowed).toBe(true);
      expect(readiness.blockers).toHaveLength(0);
    });

    it('should block policy creation if payment is not confirmed', async () => {
      prisma.quotation.findUnique.mockResolvedValue({
        id: 'q-10',
        calculationSnapshot: { some: 'data' },
        issuanceStatus: 'PAYMENT_PENDING',
        workflowState: 'QUOTATION_DRAFT',
      });
      prisma.motorPaymentRecord.findUnique.mockResolvedValue(null);

      const readiness = await service.canProceedToPolicy('q-10');
      expect(readiness.allowed).toBe(false);
      expect(readiness.blockers).toContain('PAYMENT_NOT_CONFIRMED');
    });
  });
});
