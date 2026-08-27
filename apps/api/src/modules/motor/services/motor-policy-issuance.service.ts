import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction, RoleType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IssueMotorPolicyDto } from '../dto/issue-motor-policy.dto';
import { MotorPaymentTrackingService } from './motor-payment-tracking.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';

@Injectable()
export class MotorPolicyIssuanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: MotorPaymentTrackingService,
    private readonly authzService: ResourceAuthorizationService,
  ) {}

  async issuePolicy(
    quotationId: string,
    dto: IssueMotorPolicyDto,
    actor: ActorContext,
  ) {
    // 1. Authoritative Resource Authorization Check
    this.authzService.authorize(actor, 'POLICY', 'ISSUE');

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

    const actorId = actor.userId || (actor as any).id;

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
          createdById: actorId,
          updatedById: actorId,
        },
      });

      await tx.policyHistory.create({
        data: {
          policyId: policy.id,
          status: 'ACTIVE',
          comments: `Motor policy issued from quotation ${quote.quotationCode} by ${actor.role}.`,
          createdById: actorId,
        },
      });

      await tx.quotation.update({
        where: { id: quote.id },
        data: {
          issuanceStatus: 'ISSUED',
          status: 'CONVERTED_TO_POLICY',
          workflowState: 'ACTIVE',
          updatedById: actorId,
        },
      });

      await tx.quotationHistory.create({
        data: {
          quotationId: quote.id,
          status: 'CONVERTED_TO_POLICY',
          comments: `Motor policy ${policy.policyNumber} issued by ${actor.role}.`,
          createdById: actorId,
        },
      });

      if (quote.leadId) {
        const fromLead = quote.lead?.currentWorkflowStep || 'PAYMENT';
        await tx.lead.update({
          where: { id: quote.leadId },
          data: {
            status: 'POLICY_ISSUED',
            currentWorkflowStep: 'ISSUED',
            updatedById: actorId,
          },
        });
        await tx.leadStageHistory.create({
          data: {
            leadId: quote.leadId,
            fromStage: fromLead,
            toStage: 'ISSUED',
            performedById: actorId,
            performerRole: actor.role,
            isOverride: false,
            prerequisitesMet: { quotationId: quote.id, policyId: policy.id },
            remarks: `Lead completed automatically after Motor policy issuance ${policy.policyNumber}.`,
          },
        });
      }

      // Schedule renewal reminder 30 days BEFORE expiry (not on expiry day)
      const renewalDueDate = new Date(effectiveExpiry);
      renewalDueDate.setDate(renewalDueDate.getDate() - 30);

      await tx.renewalTask.create({
        data: {
          policyId: policy.id,
          agentId: quote.lead?.assignedToId || actorId,
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
          performedById: actorId,
          userId: actorId,
          module: 'MOTOR',
          metadata: {
            quotationId: quote.id,
            leadId: quote.leadId,
            policyNumber: policy.policyNumber,
          },
        },
      });

      return policy;
    });
  }
}
