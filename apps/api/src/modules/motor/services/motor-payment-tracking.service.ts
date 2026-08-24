import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentTrackingStatus } from '@prisma/client';

export interface RecordPaymentDto {
  quotationId: string;
  status: 'NOT_DONE' | 'UNDER_PROCESS' | 'PAID';
  amount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  paidAt?: string;
  notes?: string;
  recordedById?: string;
}

@Injectable()
export class MotorPaymentTrackingService {
  private readonly logger = new Logger(MotorPaymentTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(dto: RecordPaymentDto) {
    const quotation = await this.prisma.quotation.findUnique({ where: { id: dto.quotationId } });
    if (!quotation) throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    const payment = await this.prisma.motorPaymentRecord.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        status: dto.status as PaymentTrackingStatus,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
        recordedById: dto.recordedById,
      },
      update: {
        status: dto.status as PaymentTrackingStatus,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : undefined,
        notes: dto.notes,
        recordedById: dto.recordedById,
      },
    });

    // Update quotation workflow state
    const workflowState =
      dto.status === 'PAID' ? 'PAYMENT_DONE' :
      dto.status === 'UNDER_PROCESS' ? 'PAYMENT_UNDER_PROCESS' : 'PAYMENT_PENDING';

    await this.prisma.quotation.update({
      where: { id: dto.quotationId },
      data: { workflowState: workflowState as any },
    });

    this.logger.log(`Payment ${dto.status} recorded for quotation ${dto.quotationId}`);
    return payment;
  }

  /**
   * Backend gate: policy creation is only allowed when all conditions are met.
   * NEVER rely on frontend to enforce this.
   */
  async canProceedToPolicy(quotationId: string): Promise<{ allowed: boolean; blockers: string[] }> {
    const [quotation, inspection, payment] = await Promise.all([
      this.prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { motorPreviousPolicy: true },
      }),
      this.prisma.motorInspection.findUnique({ where: { quotationId } }),
      this.prisma.motorPaymentRecord.findUnique({ where: { quotationId } }),
    ]);

    const blockers: string[] = [];

    if (!quotation) {
      return { allowed: false, blockers: ['QUOTATION_NOT_FOUND'] };
    }

    // Check inspection gating
    if (inspection && inspection.status !== 'COMPLETED') {
      blockers.push(`INSPECTION_${inspection.status}`);
    }

    // Check payment
    if (!payment || payment.status !== 'PAID') {
      blockers.push('PAYMENT_NOT_CONFIRMED');
    }

    return { allowed: blockers.length === 0, blockers };
  }

  async getPayment(quotationId: string) {
    return this.prisma.motorPaymentRecord.findUnique({ where: { quotationId } });
  }
}
