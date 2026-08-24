import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
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

const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  NOT_DONE: ['NOT_DONE', 'UNDER_PROCESS'],
  UNDER_PROCESS: ['UNDER_PROCESS', 'PAID'],
  PAID: ['PAID'],
};

@Injectable()
export class MotorPaymentTrackingService {
  private readonly logger = new Logger(MotorPaymentTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(dto: RecordPaymentDto) {
    const quotation = await this.prisma.quotation.findUnique({ where: { id: dto.quotationId } });
    if (!quotation) throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    const existing = await this.prisma.motorPaymentRecord.findUnique({ where: { quotationId: dto.quotationId } });
    const current = existing?.status || 'NOT_DONE';
    const allowed = PAYMENT_TRANSITIONS[current] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(`Invalid payment transition: ${current} -> ${dto.status}`);
    }

    if (dto.status === 'PAID') {
      if (!dto.amount || dto.amount <= 0) {
        throw new BadRequestException('A positive payment amount is required before marking payment as PAID');
      }
      if (!dto.referenceNumber?.trim()) {
        throw new BadRequestException('Payment reference number is required before marking payment as PAID');
      }
    }

    const payment = await this.prisma.motorPaymentRecord.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        status: dto.status as PaymentTrackingStatus,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : (dto.status === 'PAID' ? new Date() : undefined),
        notes: dto.notes,
        recordedById: dto.recordedById,
      },
      update: {
        status: dto.status as PaymentTrackingStatus,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: dto.paidAt ? new Date(dto.paidAt) : (dto.status === 'PAID' ? new Date() : undefined),
        notes: dto.notes,
        recordedById: dto.recordedById,
      },
    });

    const workflowState =
      dto.status === 'PAID' ? 'PAYMENT_DONE' :
      dto.status === 'UNDER_PROCESS' ? 'PAYMENT_UNDER_PROCESS' : 'PAYMENT_PENDING';

    await this.prisma.quotation.update({
      where: { id: dto.quotationId },
      data: {
        workflowState: workflowState as any,
        issuanceStatus: dto.status === 'PAID' ? 'ISSUANCE_PENDING' : 'PAYMENT_PENDING',
      },
    });

    this.logger.log(`Payment ${dto.status} recorded for quotation ${dto.quotationId}`);
    return payment;
  }

  async canProceedToPolicy(quotationId: string): Promise<{ allowed: boolean; blockers: string[] }> {
    const [quotation, inspection, payment, evaluation] = await Promise.all([
      this.prisma.quotation.findUnique({ where: { id: quotationId }, include: { motorPreviousPolicy: true } }),
      this.prisma.motorInspection.findUnique({ where: { quotationId } }),
      this.prisma.motorPaymentRecord.findUnique({ where: { quotationId } }),
      this.prisma.motorRuleEvaluation.findUnique({ where: { quotationId } }),
    ]);

    if (!quotation) return { allowed: false, blockers: ['QUOTATION_NOT_FOUND'] };

    const blockers: string[] = [];

    if (!quotation.calculationSnapshot) blockers.push('CALCULATION_NOT_FINALIZED');
    if (quotation.issuanceStatus !== 'ISSUANCE_PENDING') blockers.push('QUOTATION_NOT_READY_FOR_ISSUANCE');
    if (quotation.workflowState !== 'PAYMENT_DONE') blockers.push('PAYMENT_WORKFLOW_NOT_COMPLETE');
    if (!payment || payment.status !== 'PAID') blockers.push('PAYMENT_NOT_CONFIRMED');

    const inspectionRequired = Boolean(evaluation?.inspectionRequired);
    if (!evaluation) {
      const metadata = (quotation.motorMetadata as any) || {};
      const vehicleStatus = metadata?.vehicleDetails?.vehicleStatus;
      if (vehicleStatus !== 'NEW') blockers.push('RULE_EVALUATION_REQUIRED');
    }

    if (inspectionRequired) {
      if (!inspection) {
        blockers.push('INSPECTION_REQUIRED');
      } else if (inspection.status !== 'COMPLETED') {
        blockers.push(`INSPECTION_${inspection.status}`);
      }
    }

    return { allowed: blockers.length === 0, blockers };
  }

  async getPayment(quotationId: string) {
    return this.prisma.motorPaymentRecord.findUnique({ where: { quotationId } });
  }
}
