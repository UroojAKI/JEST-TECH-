import { Test, TestingModule } from '@nestjs/testing';
import { PaymentWebhookReconciliationListener } from './payment-webhook-reconciliation.listener';
import { MotorPaymentTrackingService } from '../../../../motor/services/motor-payment-tracking.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('PaymentWebhookReconciliationListener (PAY-001 Gateway Automated Reconciliation)', () => {
  let listener: PaymentWebhookReconciliationListener;
  let paymentTrackingService: any;
  let prisma: any;

  beforeEach(async () => {
    paymentTrackingService = {
      recordPayment: jest.fn().mockResolvedValue({
        id: 'pay-rec-1',
        quotationId: 'q-123',
        status: 'PAID',
        amount: 17638.88,
      }),
    };

    prisma = {
      quotation: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentWebhookReconciliationListener,
        {
          provide: MotorPaymentTrackingService,
          useValue: paymentTrackingService,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    listener = module.get<PaymentWebhookReconciliationListener>(
      PaymentWebhookReconciliationListener,
    );
  });

  it('should be defined', () => {
    expect(listener).toBeDefined();
  });

  it('PAY-001: should automatically reconcile payment when Razorpay payment.captured event contains quotationId', async () => {
    const quote = {
      id: 'q-123',
      companyId: 'org-test',
      totalPremium: 17638.88,
    };
    prisma.quotation.findUnique.mockResolvedValue(quote);

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_HDFC12345678',
            amount: 1763888, // 1763888 paise = 17638.88 INR
            currency: 'INR',
            method: 'upi',
            created_at: 1727766000,
            notes: {
              quotationId: 'q-123',
            },
          },
        },
      },
    };

    const result = await listener.handleRazorpayPaymentCaptured(payload);

    expect(result.reconciled).toBe(true);
    expect(prisma.quotation.findUnique).toHaveBeenCalledWith({
      where: { id: 'q-123' },
    });
    expect(paymentTrackingService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        quotationId: 'q-123',
        status: 'PAID',
        amount: 17638.88,
        paymentMethod: 'UPI',
        referenceNumber: 'pay_HDFC12345678',
        idempotencyKey: 'webhook-pay_HDFC12345678',
      }),
      'org-test',
      expect.objectContaining({
        userId: 'SYSTEM_WEBHOOK',
      }),
    );
  });

  it('PAY-001: should skip reconciliation gracefully when quotationId is absent in payment notes', async () => {
    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_UNKNOWN',
            amount: 500000,
            notes: {},
          },
        },
      },
    };

    const result = await listener.handleRazorpayPaymentCaptured(payload);

    expect(result.reconciled).toBe(false);
    expect(result.reason).toBe('NO_QUOTATION_ID');
    expect(prisma.quotation.findUnique).not.toHaveBeenCalled();
    expect(paymentTrackingService.recordPayment).not.toHaveBeenCalled();
  });

  it('PAY-001: should handle missing quotation gracefully with warning', async () => {
    prisma.quotation.findUnique.mockResolvedValue(null);

    const payload = {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_MISSING',
            amount: 100000,
            notes: { quotationId: 'q-non-existent' },
          },
        },
      },
    };

    const result = await listener.handleRazorpayPaymentCaptured(payload);

    expect(result.reconciled).toBe(false);
    expect(result.reason).toBe('QUOTATION_NOT_FOUND');
    expect(paymentTrackingService.recordPayment).not.toHaveBeenCalled();
  });

  it('PAY-001: should process order.paid event seamlessly', async () => {
    const quote = {
      id: 'q-order-1',
      companyId: 'org-test',
      totalPremium: 25000.00,
    };
    prisma.quotation.findUnique.mockResolvedValue(quote);

    const payload = {
      event: 'order.paid',
      payload: {
        payment: {
          entity: {
            id: 'pay_ORDER_99',
            amount: 2500000, // 25000.00 INR
            method: 'netbanking',
            notes: { quotationId: 'q-order-1' },
          },
        },
      },
    };

    const result = await listener.handleRazorpayOrderPaid(payload);

    expect(result.reconciled).toBe(true);
    expect(paymentTrackingService.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        quotationId: 'q-order-1',
        amount: 25000,
        paymentMethod: 'NETBANKING',
      }),
      'org-test',
      expect.anything(),
    );
  });
});
