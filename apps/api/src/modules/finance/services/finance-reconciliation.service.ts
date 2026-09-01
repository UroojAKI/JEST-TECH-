import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { PaymentTrackingStatus } from '@prisma/client';

export interface ReconciliationQueueItem {
  id: string;
  quotationId: string;
  quotationCode: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  productType: string;
  insurerName: string;
  totalPayableAmount: number;
  paidAmount: number;
  variance: number;
  isExactMatch: boolean;
  paymentMethod: string;
  referenceNumber: string;
  paidAt: string | null;
  recordedAt: string;
  agingHours: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  reconciliationStatus:
    | 'PENDING_RECONCILIATION'
    | 'RECONCILED'
    | 'DISCREPANCY'
    | 'UNDER_PROCESS';
  reconciledBy?: string;
  reconciledAt?: string;
  discrepancyReason?: string;
}

export interface ReconcilePaymentDto {
  bankReference?: string;
  bankTransactionDate?: string;
  notes?: string;
}

export interface DiscrepancyDto {
  reason: string;
  notes?: string;
}

@Injectable()
export class FinanceReconciliationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retrieves the authoritative Finance Reconciliation Queue sorted by urgency (G020).
   */
  async getReconciliationQueue(params: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params.limit) || 20));
    const skip = (page - 1) * limit;

    const payments = await this.prisma.motorPaymentRecord.findMany({
      where: {
        status: {
          in: [PaymentTrackingStatus.PAID, PaymentTrackingStatus.UNDER_PROCESS],
        },
      },
      include: {
        quotation: {
          include: {
            contact: {
              select: {
                firstName: true,
                lastName: true,
                phone: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const now = Date.now();
    const items: ReconciliationQueueItem[] = [];

    let pendingCount = 0;
    let reconciledCount = 0;
    let discrepancyCount = 0;
    let totalPendingAmount = 0;
    let totalReconciledAmount = 0;

    for (const p of payments) {
      let parsedNotes: Record<string, any> = {};
      if (p.notes) {
        try {
          parsedNotes = JSON.parse(p.notes);
        } catch {
          parsedNotes = { rawNotes: p.notes };
        }
      }

      const reconStatus: ReconciliationQueueItem['reconciliationStatus'] =
        parsedNotes.reconciliationStatus ||
        (p.status === PaymentTrackingStatus.PAID
          ? 'PENDING_RECONCILIATION'
          : 'UNDER_PROCESS');

      const paidAmt = Number(p.amount || 0);
      const payableAmt = Number(p.quotation?.totalPremium || 0);
      const variance = Math.round((paidAmt - payableAmt) * 100) / 100;
      // Exact means equal, not greater-than-or-equal. Overpayments are discrepancies.
      const isExactMatch = payableAmt > 0 && Math.abs(variance) < 0.01;

      const createdTime = new Date(p.paidAt || p.createdAt).getTime();
      const agingHours = Math.max(0, Math.round((now - createdTime) / 3600000));

      let urgency: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
      if (agingHours >= 24 || !isExactMatch) {
        urgency = 'HIGH';
      } else if (agingHours >= 8) {
        urgency = 'MEDIUM';
      }

      if (reconStatus === 'RECONCILED') {
        reconciledCount++;
        totalReconciledAmount += paidAmt;
      } else if (reconStatus === 'DISCREPANCY') {
        discrepancyCount++;
      } else {
        pendingCount++;
        totalPendingAmount += paidAmt;
      }

      const item: ReconciliationQueueItem = {
        id: p.id,
        quotationId: p.quotationId,
        quotationCode: p.quotation?.quotationCode || 'N/A',
        customerName: p.quotation?.contact
          ? `${p.quotation.contact.firstName} ${p.quotation.contact.lastName || ''}`.trim()
          : 'Unknown Customer',
        customerPhone: p.quotation?.contact?.phone || undefined,
        customerEmail: p.quotation?.contact?.email || undefined,
        productType: p.quotation?.productType || 'MOTOR',
        insurerName: p.quotation?.insurerName || 'UNKNOWN',
        totalPayableAmount: payableAmt,
        paidAmount: paidAmt,
        variance,
        isExactMatch,
        paymentMethod: p.paymentMethod || 'OTHER',
        referenceNumber: p.referenceNumber || 'N/A',
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        recordedAt: p.createdAt.toISOString(),
        agingHours,
        urgency,
        reconciliationStatus: reconStatus,
        reconciledBy: parsedNotes.reconciledBy,
        reconciledAt: parsedNotes.reconciledAt,
        discrepancyReason: parsedNotes.discrepancyReason,
      };

      if (params.status && params.status !== 'ALL') {
        if (item.reconciliationStatus !== params.status) continue;
      }

      if (params.search && params.search.trim()) {
        const query = params.search.toLowerCase().trim();
        const matches =
          item.quotationCode.toLowerCase().includes(query) ||
          item.customerName.toLowerCase().includes(query) ||
          item.referenceNumber.toLowerCase().includes(query);
        if (!matches) continue;
      }

      items.push(item);
    }

    const total = items.length;
    const paginatedItems = items.slice(skip, skip + limit);

    return {
      data: paginatedItems,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        pendingCount,
        reconciledCount,
        discrepancyCount,
        totalPendingAmount: Math.round(totalPendingAmount * 100) / 100,
        totalReconciledAmount: Math.round(totalReconciledAmount * 100) / 100,
      },
    };
  }

  /**
   * Reconciles a payment against bank credit statement.
   * Payment and quotation state changes are atomic and audited together.
   */
  async reconcilePayment(
    id: string,
    actorId: string,
    dto: ReconcilePaymentDto,
  ) {
    const payment = await this.prisma.motorPaymentRecord.findUnique({
      where: { id },
      include: { quotation: true },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record with ID ${id} not found`);
    }

    if (payment.status !== PaymentTrackingStatus.PAID) {
      throw new BadRequestException(
        `Cannot reconcile payment in ${payment.status} status. Payment must be recorded as PAID first.`,
      );
    }

    let existingNotes: Record<string, any> = {};
    if (payment.notes) {
      try {
        existingNotes = JSON.parse(payment.notes);
      } catch {
        existingNotes = { rawNotes: payment.notes };
      }
    }

    if (existingNotes.reconciliationStatus === 'RECONCILED') {
      throw new BadRequestException('Payment has already been reconciled.');
    }

    if (existingNotes.reconciliationStatus === 'DISCREPANCY') {
      throw new BadRequestException(
        'Payment has an unresolved discrepancy and cannot be reconciled.',
      );
    }

    const paidAmount = Number(payment.amount || 0);
    const payableAmount = Number(payment.quotation?.totalPremium || 0);
    const variance = Math.round((paidAmount - payableAmount) * 100) / 100;

    if (payableAmount <= 0) {
      throw new BadRequestException(
        'Cannot reconcile a payment against a quotation with no payable premium.',
      );
    }

    if (Math.abs(variance) >= 0.01) {
      throw new BadRequestException(
        `Payment amount does not exactly match payable premium. Variance: ${variance}`,
      );
    }

    if (dto.bankTransactionDate && Number.isNaN(new Date(dto.bankTransactionDate).getTime())) {
      throw new BadRequestException('Bank transaction date is invalid.');
    }

    const reconciledAt = new Date().toISOString();
    const updatedNotes = {
      ...existingNotes,
      reconciliationStatus: 'RECONCILED',
      reconciledBy: actorId,
      reconciledAt,
      bankReference: dto.bankReference || payment.referenceNumber,
      bankTransactionDate:
        dto.bankTransactionDate || new Date().toISOString(),
      financeNotes: dto.notes,
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorPaymentRecord.update({
        where: { id },
        data: { notes: JSON.stringify(updatedNotes) },
      });

      await tx.quotation.update({
        where: { id: payment.quotationId },
        data: { issuanceStatus: 'PAYMENT_CONFIRMED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'MotorPaymentRecord',
          entityId: id,
          userId: actorId,
          performedById: actorId,
          module: 'FINANCE',
          oldValue: {
            reconciliationStatus: existingNotes.reconciliationStatus || 'PENDING_RECONCILIATION',
          },
          newValue: {
            reconciliationStatus: 'RECONCILED',
            quotationIssuanceStatus: 'PAYMENT_CONFIRMED',
          },
          metadata: {
            bankReference: updatedNotes.bankReference,
            bankTransactionDate: updatedNotes.bankTransactionDate,
            variance,
          },
        },
      });

      return updated;
    });

    return {
      id: result.id,
      quotationId: result.quotationId,
      status: 'RECONCILED',
      reconciledBy: actorId,
      reconciledAt,
      message:
        'Payment successfully reconciled with bank statement. Quotation ready for policy issuance.',
    };
  }

  /**
   * Marks a payment as DISCREPANCY with reason.
   */
  async flagDiscrepancy(id: string, actorId: string, dto: DiscrepancyDto) {
    const payment = await this.prisma.motorPaymentRecord.findUnique({
      where: { id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment record with ID ${id} not found`);
    }

    if (!dto.reason || !dto.reason.trim()) {
      throw new BadRequestException(
        'A non-empty discrepancy reason is required.',
      );
    }

    let existingNotes: Record<string, any> = {};
    if (payment.notes) {
      try {
        existingNotes = JSON.parse(payment.notes);
      } catch {
        existingNotes = { rawNotes: payment.notes };
      }
    }

    if (existingNotes.reconciliationStatus === 'RECONCILED') {
      throw new BadRequestException(
        'A reconciled payment cannot be flagged as a new discrepancy.',
      );
    }

    const flaggedAt = new Date().toISOString();
    const updatedNotes = {
      ...existingNotes,
      reconciliationStatus: 'DISCREPANCY',
      flaggedBy: actorId,
      flaggedAt,
      discrepancyReason: dto.reason.trim(),
      financeNotes: dto.notes,
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const record = await tx.motorPaymentRecord.update({
        where: { id },
        data: { notes: JSON.stringify(updatedNotes) },
      });

      await tx.auditLog.create({
        data: {
          action: 'UPDATE',
          entity: 'MotorPaymentRecord',
          entityId: id,
          userId: actorId,
          performedById: actorId,
          module: 'FINANCE',
          oldValue: {
            reconciliationStatus: existingNotes.reconciliationStatus || 'PENDING_RECONCILIATION',
          },
          newValue: {
            reconciliationStatus: 'DISCREPANCY',
            discrepancyReason: dto.reason.trim(),
          },
        },
      });

      return record;
    });

    return {
      id: updated.id,
      quotationId: updated.quotationId,
      status: 'DISCREPANCY',
      reason: dto.reason.trim(),
      flaggedBy: actorId,
      message:
        'Payment discrepancy recorded. Policy issuance blocked until resolved.',
    };
  }
}
