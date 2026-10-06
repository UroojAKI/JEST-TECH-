import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MotorPaymentTrackingService } from '../../../../motor/services/motor-payment-tracking.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { RoleType } from '@prisma/client';

@Injectable()
export class PaymentWebhookReconciliationListener {
  private readonly logger = new Logger(PaymentWebhookReconciliationListener.name);

  constructor(
    private readonly paymentTrackingService: MotorPaymentTrackingService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('integration.webhook.razorpay.payment.captured')
  async handleRazorpayPaymentCaptured(payload: any) {
    this.logger.log('Processing Razorpay payment.captured webhook for reconciliation');
    return this.reconcileRazorpayPayment(payload);
  }

  @OnEvent('integration.webhook.razorpay.order.paid')
  async handleRazorpayOrderPaid(payload: any) {
    this.logger.log('Processing Razorpay order.paid webhook for reconciliation');
    return this.reconcileRazorpayPayment(payload);
  }

  async reconcileRazorpayPayment(payload: any) {
    try {
      const paymentEntity =
        payload?.payload?.payment?.entity ||
        payload?.payment?.entity ||
        payload?.payment ||
        payload;

      const notes = paymentEntity?.notes || {};
      const quotationId =
        notes.quotationId ||
        notes.quoteId ||
        notes.quotation_id ||
        notes.referenceId;

      if (!quotationId) {
        this.logger.debug(
          `No quotationId found in webhook payment notes (payment id: ${paymentEntity?.id}). Skipping motor reconciliation.`,
        );
        return { reconciled: false, reason: 'NO_QUOTATION_ID' };
      }

      const quotation = await this.prisma.quotation.findUnique({
        where: { id: quotationId },
      });

      if (!quotation) {
        this.logger.warn(
          `Quotation ${quotationId} specified in webhook payment ${paymentEntity?.id} not found`,
        );
        return { reconciled: false, reason: 'QUOTATION_NOT_FOUND' };
      }

      // Razorpay amount is in smallest currency unit (paise) -> divide by 100 for INR
      const rawAmount = paymentEntity?.amount;
      const amountInInr =
        typeof rawAmount === 'number'
          ? rawAmount / 100
          : Number(rawAmount) / 100;

      const referenceNumber = paymentEntity?.id || `PAY-${Date.now()}`;
      const paymentMethod = String(
        paymentEntity?.method || 'RAZORPAY',
      ).toUpperCase();

      this.logger.log(
        `Auto-reconciling payment for quotation ${quotationId}: amount ₹${amountInInr}, ref ${referenceNumber}`,
      );

      const paymentRecord = await this.paymentTrackingService.recordPayment(
        {
          quotationId,
          status: 'PAID',
          amount: amountInInr,
          paymentMethod,
          referenceNumber,
          paidAt: paymentEntity?.created_at
            ? new Date(paymentEntity.created_at * 1000).toISOString()
            : new Date().toISOString(),
          notes: `Automated webhook reconciliation via Razorpay (${referenceNumber})`,
          idempotencyKey: `webhook-${referenceNumber}`,
        },
        quotation.companyId,
        {
          userId: 'SYSTEM_WEBHOOK',
          role: RoleType.ADMIN,
          roles: [RoleType.ADMIN],
          companyId: quotation.companyId,
          organizationId: quotation.companyId,
          email: 'system.webhook@jest.internal',
          firstName: 'System',
          lastName: 'Webhook',
          permissions: [],
          workspaces: ['BACK_OFFICE'],
        } as any,
      );

      this.logger.log(
        `Successfully auto-reconciled payment for quotation ${quotationId}`,
      );
      return { reconciled: true, paymentRecord };
    } catch (err: any) {
      this.logger.error(
        `Error auto-reconciling webhook payment: ${err.message}`,
        err.stack,
      );
      return { reconciled: false, error: err.message };
    }
  }
}
