import { Test, TestingModule } from '@nestjs/testing';
import { FinanceReconciliationService } from './finance-reconciliation.service';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentTrackingStatus, Prisma } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('FinanceReconciliationService (G020 Reconciliation Queue)', () => {
  let service: FinanceReconciliationService;
  let prisma: PrismaService;

  const mockPrisma = {
    motorPaymentRecord: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    quotation: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceReconciliationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<FinanceReconciliationService>(FinanceReconciliationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getReconciliationQueue', () => {
    it('returns reconciliation queue sorted by urgency with financial variance', async () => {
      const mockPayments = [
        {
          id: 'pay-1',
          quotationId: 'q-1',
          status: PaymentTrackingStatus.PAID,
          amount: new Prisma.Decimal(15000),
          paymentMethod: 'UPI',
          referenceNumber: 'UPI-987654',
          paidAt: new Date(Date.now() - 36 * 3600000), // 36 hours ago (HIGH urgency)
          createdAt: new Date(Date.now() - 36 * 3600000),
          notes: null,
          quotation: {
            quotationCode: 'QTN-001',
            productType: 'MOTOR',
            insurerName: 'HDFC ERGO',
            totalPremium: new Prisma.Decimal(15000),
            contact: {
              firstName: 'Rahul',
              lastName: 'Sharma',
              phone: '9876543210',
              email: 'rahul@example.com',
            },
          },
        },
      ];

      mockPrisma.motorPaymentRecord.findMany.mockResolvedValue(mockPayments);

      const result = await service.getReconciliationQueue({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.quotationCode).toBe('QTN-001');
      expect(item.customerName).toBe('Rahul Sharma');
      expect(item.isExactMatch).toBe(true);
      expect(item.variance).toBe(0);
      expect(item.urgency).toBe('HIGH'); // Over 24 hours
      expect(result.summary.pendingCount).toBe(1);
      expect(result.summary.totalPendingAmount).toBe(15000);
    });
  });

  describe('reconcilePayment', () => {
    it('reconciles payment and advances quotation to PAYMENT_CONFIRMED', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pay-1',
        quotationId: 'q-1',
        status: PaymentTrackingStatus.PAID,
        referenceNumber: 'UTR-111222',
        notes: null,
      });

      mockPrisma.motorPaymentRecord.update.mockResolvedValue({
        id: 'pay-1',
        quotationId: 'q-1',
      });

      const result = await service.reconcilePayment('pay-1', 'fin-officer-1', {
        bankReference: 'BANK-UTR-999',
        notes: 'Matched with HDFC Current Account statement',
      });

      expect(result.status).toBe('RECONCILED');
      expect(mockPrisma.quotation.update).toHaveBeenCalledWith({
        where: { id: 'q-1' },
        data: { issuanceStatus: 'PAYMENT_CONFIRMED' },
      });
    });

    it('rejects reconciliation if payment status is NOT_DONE', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pay-2',
        status: PaymentTrackingStatus.NOT_DONE,
      });

      await expect(
        service.reconcilePayment('pay-2', 'fin-officer-1', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('flagDiscrepancy', () => {
    it('flags discrepancy and requires mandatory reason', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pay-3',
        quotationId: 'q-3',
        status: PaymentTrackingStatus.PAID,
      });

      await expect(
        service.flagDiscrepancy('pay-3', 'fin-officer-1', { reason: '' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully flags discrepancy with reason', async () => {
      mockPrisma.motorPaymentRecord.findUnique.mockResolvedValue({
        id: 'pay-4',
        quotationId: 'q-4',
        status: PaymentTrackingStatus.PAID,
      });

      mockPrisma.motorPaymentRecord.update.mockResolvedValue({
        id: 'pay-4',
        quotationId: 'q-4',
      });

      const result = await service.flagDiscrepancy('pay-4', 'fin-officer-1', {
        reason: 'UTR not credited in company bank account after 48 hours',
      });

      expect(result.status).toBe('DISCREPANCY');
      expect(result.reason).toContain('UTR not credited');
    });
  });
});
