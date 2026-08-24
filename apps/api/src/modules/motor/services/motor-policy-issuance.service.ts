import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IssueMotorPolicyDto } from '../dto/issue-motor-policy.dto';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';

export interface IssuingUser {
  id: string;
  role: string;
}

const ISSUANCE_ROLES = new Set([
  'SUPER_ADMIN',
  'ADMIN',
  'OPERATIONS',
  'POLICY_ISSUANCE_EXECUTIVE',
]);

@Injectable()
export class MotorPolicyIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: MotorPaymentTrackingService,
  ) {}

  async issuePolicy(quotationId: string, dto: IssueMotorPolicyDto, user: IssuingUser) {
    if (!ISSUANCE_ROLES.has(user.role)) {
      throw new ForbiddenException('Only Back Office / Policy Issuance roles can issue a motor policy');
    }

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Valid policy start and end dates are required');
    }
    if (endDate < startDate) {
      throw new BadRequestException('Policy end date cannot be before policy start date');
    }

    const gate = await this.paymentService.canProceedToPolicy(quotationId);
    if (!gate.allowed) {
      throw new ConflictException({
        message: 'Policy issuance is blocked by the Motor workflow gate',
        blockers: gate.blockers,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { contact: true, lead: true, policy: true },
      });

      if (!quote) throw new NotFoundException(`Quotation ${quotationId} not found`);
      if (quote.policy) throw new ConflictException('A policy already exists for this quotation');
      if (quote.workflowState !== 'PAYMENT_DONE') throw new ConflictException('Quotation is not in PAYMENT_DONE state');
      if (!quote.calculationSnapshot) throw new ConflictException('Authoritative calculation snapshot is required before issuance');

      const snapshot = (quote.calculationSnapshot as Record<string, any>) || {};
      const inputs = snapshot.inputs || {};
      const policyType = quote.policyType || inputs.policyType;
      const tenure = Number(inputs.tpTenure || quote.policyTenure || 1);

      const odStart = dto.odStartDate ? new Date(dto.odStartDate) : startDate;
      const tpStart = dto.tpStartDate ? new Date(dto.tpStartDate) : startDate;
      let odExpiry = dto.odExpiryDate ? new Date(dto.odExpiryDate) : null;
      let tpExpiry = dto.tpExpiryDate ? new Date(dto.tpExpiryDate) : null;

      if (policyType === 'THIRD_PARTY_ONLY') {
        tpExpiry = tpExpiry || endDate;
      } else if (policyType === 'STANDALONE_OD' || policyType === 'SAOD') {
        odExpiry = odExpiry || endDate;
      } else {
        odExpiry = odExpiry || endDate;
        if (!tpExpiry) {
          tpExpiry = new Date(tpStart);
          tpExpiry.setFullYear(tpExpiry.getFullYear() + tenure);
        }
      }

      const effectiveExpiry = [odExpiry, tpExpiry, endDate]
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime())[0] || endDate;

      const policy = await tx.policy.create({
        data: {
          policyNumber: dto.actualPolicyNumber,
          actualPolicyNumber: dto.actualPolicyNumber,
          quotationId: quote.id,
          contactId: quote.contactId,
          accountId: quote.accountId || undefined,
          status: 'ACTIVE',
          premiumAmount: quote.totalPremium,
          effectiveDate: startDate,
          expiryDate: effectiveExpiry,
          policyTenure: tenure,
          issueDate: new Date(),
          startDate,
          endDate,
          odStartDate: odStart,
          odExpiryDate: odExpiry,
          tpStartDate: tpStart,
          tpExpiryDate: tpExpiry,
          actualPremium: dto.actualPremium,
          paymentStatus: 'SUCCESS',
          vehicleId: quote.vehicleId || undefined,
          vehicleCategory: quote.vehicleCategory || undefined,
          policyType: policyType || undefined,
          motorMetadata: quote.motorMetadata || undefined,
          activeTpInsurer: quote.activeTpInsurer || undefined,
          activeTpPolicyNumber: quote.activeTpPolicyNumber || undefined,
          activeTpExpiryDate: quote.activeTpExpiryDate || undefined,
          createdById: user.id,
          updatedById: user.id,
        },
      });

      await tx.policyHistory.create({
        data: {
          policyId: policy.id,
          status: 'ACTIVE',
          comments: `Motor policy issued from quotation ${quote.quotationCode} by ${user.role}.`,
          createdById: user.id,
        },
      });

      await tx.quotation.update({
        where: { id: quote.id },
        data: {
          issuanceStatus: 'ISSUED',
          status: 'CONVERTED_TO_POLICY',
          workflowState: 'ACTIVE',
          updatedById: user.id,
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: quote.id,
          status: 'CONVERTED_TO_POLICY',
          comments: `Motor policy ${policy.policyNumber} issued by ${user.role}.`,
          createdById: user.id,
        },
      });

      if (quote.leadId) {
        const fromLead = quote.lead?.currentWorkflowStep || 'PAYMENT';
        await tx.lead.update({
          where: { id: quote.leadId },
          data: {
            status: 'POLICY_ISSUED',
            currentWorkflowStep: 'ISSUED',
            updatedById: user.id,
          },
        });
        await tx.leadStageHistory.create({
          data: {
            leadId: quote.leadId,
            fromStage: fromLead,
            toStage: 'ISSUED',
            performedById: user.id,
            performerRole: user.role,
            isOverride: false,
            prerequisitesMet: { quotationId: quote.id, policyId: policy.id },
            remarks: `Lead completed automatically after Motor policy issuance ${policy.policyNumber}.`,
          },
        });
      }

      const renewalDueDate = [odExpiry, tpExpiry]
        .filter((date): date is Date => Boolean(date))
        .sort((a, b) => a.getTime() - b.getTime())[0] || endDate;
      await tx.renewalTask.create({
        data: {
          policyId: policy.id,
          agentId: quote.lead?.assignedToId || user.id,
          dueDate: renewalDueDate,
          status: 'PENDING',
          priority: 'HIGH',
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entity: 'Policy',
          entityId: policy.id,
          entityType: 'MOTOR_POLICY_ISSUANCE',
          performedById: user.id,
          userId: user.id,
          module: 'MOTOR',
          metadata: {
            quotationId: quote.id,
            leadId: quote.leadId,
            policyNumber: policy.policyNumber,
            policyType,
            odExpiryDate: odExpiry?.toISOString() || null,
            tpExpiryDate: tpExpiry?.toISOString() || null,
          },
        },
      });

      return policy;
    });
  }
}
