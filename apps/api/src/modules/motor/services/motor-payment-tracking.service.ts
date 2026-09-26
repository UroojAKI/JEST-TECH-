import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  PaymentTrackingStatus,
  InspectionStatus,
  QuotationStatus,
  RoleType,
  Prisma,
} from '@prisma/client';

export interface RecordPaymentDto {
  quotationId: string;
  status: 'NOT_DONE' | 'UNDER_PROCESS' | 'PAID';
  amount?: number;
  paymentMethod?: string;
  referenceNumber?: string;
  paidAt?: string;
  notes?: string;
  recordedById?: string;
  recordedByRole?: string;
}

const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  NOT_DONE: ['NOT_DONE', 'UNDER_PROCESS', 'PAID'],
  UNDER_PROCESS: ['UNDER_PROCESS', 'PAID'],
  PAID: [],
};

const FINANCE_PAYMENT_ROLES = new Set([
  RoleType.ADMIN,
  'ADMIN',
  RoleType.BACK_OFFICE,
  'BACK_OFFICE',
  'SUPER_ADMIN',
  'SYSTEM_ADMINISTRATOR',
  'MD_CEO',
  'OPERATIONS',
  'POLICY_ISSUANCE_EXECUTIVE',
  'BRANCH_MANAGER',
  'SALES_MANAGER',
  'SALES_EXECUTIVE',
  'SALES_AGENT',
  'POSP_ADVISOR',
  'AGENT_MANAGER',
  'TEAM_LEADER',
  'FINANCE',
  'FINANCE_ACCOUNTS_EXECUTIVE',
  'CHIEF_FINANCE_OFFICER',
]);

@Injectable()
export class MotorPaymentTrackingService {
  private readonly logger = new Logger(MotorPaymentTrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordPayment(dto: RecordPaymentDto, actorCompanyId?: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }

    const existing = await this.prisma.motorPaymentRecord.findUnique({
      where: { quotationId: dto.quotationId },
    });

    if (existing?.status === 'PAID') {
      if (
        dto.status === 'PAID' &&
        existing.referenceNumber === dto.referenceNumber &&
        Number(existing.amount) === Number(dto.amount)
      ) {
        this.logger.log(
          `Idempotent duplicate payment verified for quotation ${dto.quotationId}, ref: ${dto.referenceNumber}`,
        );
        return existing;
      }
      throw new BadRequestException(
        `Financial immutability violation: Payment for quotation ${dto.quotationId} is already verified and marked as PAID. Reconciled payments are strictly immutable.`,
      );
    }

    const current = existing?.status || 'NOT_DONE';
    const allowed = PAYMENT_TRANSITIONS[current] || [];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Invalid payment transition: ${current} -> ${dto.status}`,
      );
    }

    if (dto.status === 'PAID') {
      if (dto.recordedByRole) {
        const role = String(dto.recordedByRole).toUpperCase();
        if (!FINANCE_PAYMENT_ROLES.has(role)) {
          throw new ForbiddenException(
            'Only Finance or an authorized Administrator can verify a payment as PAID. Sales users may record UNDER_PROCESS only.',
          );
        }
      }
      if (!dto.amount || dto.amount <= 0) {
        throw new BadRequestException(
          'A positive payment amount is required before marking payment as PAID',
        );
      }
      if (!dto.referenceNumber?.trim()) {
        throw new BadRequestException(
          'Payment reference number is required before marking payment as PAID',
        );
      }

      // MOTOR-REG-07: Proposal must be approved before payment can be recorded
      if (quotation.productType === 'MOTOR') {
        const proposal = await this.prisma.proposal.findUnique({
          where: { quotationId: dto.quotationId },
        });
        if (!proposal || proposal.status !== 'APPROVED') {
          throw new BadRequestException(
            'Proposal has not been approved yet. Payment can only be recorded after proposal approval.',
          );
        }
      }

      // MOTOR-REG-08: Exact decimal reconciliation
      const authoritativePayable = new Prisma.Decimal(quotation.totalPremium);
      const paidAmount = new Prisma.Decimal(dto.amount);
      if (!paidAmount.equals(authoritativePayable)) {
        throw new BadRequestException(
          `Financial reconciliation failure: Received amount ₹${paidAmount.toString()} does not match authoritative payable amount ₹${authoritativePayable.toString()}. Exact reconciliation is mandatory.`,
        );
      }

      const inspection = await this.prisma.motorInspection.findUnique({
        where: { quotationId: dto.quotationId },
      });
      const ruleEval = await this.prisma.motorRuleEvaluation.findUnique({
        where: { quotationId: dto.quotationId },
      });
      if (
        (ruleEval?.inspectionRequired ||
          quotation.workflowState === 'INSPECTION_REQUIRED') &&
        inspection?.status !== InspectionStatus.COMPLETED
      ) {
        throw new BadRequestException(
          'Vehicle inspection is required for this quotation before payment can be verified. Please complete and sign off the inspection first.',
        );
      }
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const paymentRecord = await tx.motorPaymentRecord.upsert({
        where: { quotationId: dto.quotationId },
        create: {
          companyId: quotation.companyId,
          quotationId: dto.quotationId,
          status: dto.status,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          paidAt: dto.paidAt
            ? new Date(dto.paidAt)
            : dto.status === 'PAID'
              ? new Date()
              : undefined,
          notes: dto.notes,
          recordedById: dto.recordedById,
        },
        update: {
          companyId: quotation.companyId,
          status: dto.status,
          amount: dto.amount,
          paymentMethod: dto.paymentMethod,
          referenceNumber: dto.referenceNumber,
          paidAt: dto.paidAt
            ? new Date(dto.paidAt)
            : dto.status === 'PAID'
              ? new Date()
              : undefined,
          notes: dto.notes,
          recordedById: dto.recordedById,
        },
      });

      const workflowState =
        dto.status === 'PAID'
          ? 'PAYMENT_DONE'
          : dto.status === 'UNDER_PROCESS'
            ? 'PAYMENT_UNDER_PROCESS'
            : 'PAYMENT_PENDING';
      const metadata = (quotation.motorMetadata as any) || {};

      await tx.quotation.update({
        where: { id: dto.quotationId },
        data: {
          status:
            dto.status === 'PAID' ? QuotationStatus.ACCEPTED : quotation.status,
          workflowState: workflowState as any,
          issuanceStatus:
            dto.status === 'PAID' ? 'ISSUANCE_PENDING' : 'PAYMENT_PENDING',
          motorMetadata: {
            ...metadata,
            workflowStatus:
              dto.status === 'PAID'
                ? 'PENDING_ISSUANCE'
                : dto.status === 'UNDER_PROCESS'
                  ? 'PAYMENT_UNDER_PROCESS'
                  : 'PAYMENT_PENDING',
          },
        },
      });

      return paymentRecord;
    });

    this.logger.log(
      `Payment ${dto.status} recorded for quotation ${dto.quotationId}`,
    );
    return payment;
  }

  async canProceedToPolicy(
    quotationId: string,
    actorCompanyId?: string,
  ): Promise<{ allowed: boolean; blockers: string[] }> {
    const [quotation, inspection, payment, evaluation] = await Promise.all([
      this.prisma.quotation.findUnique({
        where: { id: quotationId },
        include: { motorPreviousPolicy: true },
      }),
      this.prisma.motorInspection.findUnique({ where: { quotationId } }),
      this.prisma.motorPaymentRecord.findUnique({ where: { quotationId } }),
      this.prisma.motorRuleEvaluation.findUnique({ where: { quotationId } }),
    ]);

    if (!quotation)
      return { allowed: false, blockers: ['QUOTATION_NOT_FOUND'] };

    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }

    const blockers: string[] = [];
    if (!quotation.calculationSnapshot)
      blockers.push('CALCULATION_NOT_FINALIZED');
    if (quotation.issuanceStatus !== 'ISSUANCE_PENDING')
      blockers.push('QUOTATION_NOT_READY_FOR_ISSUANCE');
    if (quotation.workflowState !== 'PAYMENT_DONE')
      blockers.push('PAYMENT_WORKFLOW_NOT_COMPLETE');
    if (!payment || payment.status !== 'PAID')
      blockers.push('PAYMENT_NOT_CONFIRMED');

    const inspectionRequired = Boolean(evaluation?.inspectionRequired);
    if (inspectionRequired) {
      if (!inspection) blockers.push('INSPECTION_RECORD_MISSING');
      else if (
        inspection.status !== InspectionStatus.COMPLETED &&
        inspection.status !== InspectionStatus.NOT_REQUIRED
      )
        blockers.push(`INSPECTION_NOT_COMPLETE_STATUS_${inspection.status}`);
    }

    return { allowed: blockers.length === 0, blockers };
  }

  async getPayment(quotationId: string, actorCompanyId?: string) {
    if (actorCompanyId) {
      const quotation = await this.prisma.quotation.findUnique({
        where: { id: quotationId },
        select: { companyId: true },
      });
      if (!quotation) {
        throw new NotFoundException(`Quotation ${quotationId} not found`);
      }
      if (quotation.companyId && quotation.companyId !== actorCompanyId) {
        throw new ForbiddenException(
          'Cross-organization access is strictly prohibited',
        );
      }
    }
    return this.prisma.motorPaymentRecord.findUnique({
      where: { quotationId },
    });
  }
}
