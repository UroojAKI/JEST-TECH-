import { Test, TestingModule } from '@nestjs/testing';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

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
