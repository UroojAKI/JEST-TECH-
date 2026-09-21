import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus } from '@prisma/client';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class LeadLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly allowedTransitions: Record<LeadStatus, LeadStatus[]> = {
    [LeadStatus.NEW]: [
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.UNQUALIFIED,
      LeadStatus.LOST,
    ],
    [LeadStatus.CONTACTED]: [
      LeadStatus.QUALIFIED,
      LeadStatus.UNQUALIFIED,
      LeadStatus.LOST,
    ],
    [LeadStatus.QUALIFIED]: [
      LeadStatus.QUOTATION,
      LeadStatus.LOST,
      LeadStatus.UNQUALIFIED,
    ],
    [LeadStatus.QUOTATION]: [LeadStatus.CUSTOMER_ACCEPTED, LeadStatus.LOST],
    [LeadStatus.CUSTOMER_ACCEPTED]: [
      LeadStatus.PAYMENT_PENDING,
      LeadStatus.LOST,
    ],
    [LeadStatus.PAYMENT_PENDING]: [LeadStatus.POST_PAYMENT, LeadStatus.LOST],
    [LeadStatus.POST_PAYMENT]: [LeadStatus.BACK_OFFICE, LeadStatus.LOST],
    [LeadStatus.BACK_OFFICE]: [LeadStatus.CONVERTED, LeadStatus.LOST],
    [LeadStatus.CONVERTED]: [],
    [LeadStatus.LOST]: [LeadStatus.CONTACTED],
    [LeadStatus.UNQUALIFIED]: [LeadStatus.CONTACTED],

    // Legacy transitional mapping for continuous compatibility
    [LeadStatus.DOCS_RECEIVED]: [
      LeadStatus.QUOTE_PREPARED,
      LeadStatus.QUOTATION,
      LeadStatus.LOST,
    ],
    [LeadStatus.QUOTE_PREPARED]: [
      LeadStatus.NEGOTIATION,
      LeadStatus.CUSTOMER_ACCEPTED,
      LeadStatus.LOST,
    ],
    [LeadStatus.NEGOTIATION]: [
      LeadStatus.CUSTOMER_ACCEPTED,
      LeadStatus.PAYMENT_PENDING,
      LeadStatus.LOST,
    ],
    [LeadStatus.PAYMENT_RECEIVED]: [
      LeadStatus.POST_PAYMENT,
      LeadStatus.BACK_OFFICE,
      LeadStatus.CONVERTED,
    ],
    [LeadStatus.POLICY_ISSUED]: [LeadStatus.CONVERTED],
  };

  getAllowedTransitions(currentStatus: LeadStatus): LeadStatus[] {
    return this.allowedTransitions[currentStatus] || [];
  }

  async validateTransition(
    leadId: string,
    targetStatus: LeadStatus,
  ): Promise<{ valid: boolean; lead: any }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        quotations: true,
        motorQuotations: true,
        vehicles: true,
        backOfficeTasks: true,
      },
    });

    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const currentStatus = lead.status;

    // Check FSM allowed transitions
    const allowed = this.getAllowedTransitions(currentStatus);
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Illegal transition from ${currentStatus} to ${targetStatus}. Allowed next states: ${allowed.join(', ') || 'None (Terminal state)'}`,
      );
    }

    // Deep Business Gate Enforcements
    if (targetStatus === LeadStatus.QUOTATION) {
      const hasVehicle = lead.vehicles.length > 0;
      if (!hasVehicle) {
        throw new BadRequestException(
          'Lead cannot enter QUOTATION stage without at least one linked Vehicle record.',
        );
      }
    }

    if (targetStatus === LeadStatus.CUSTOMER_ACCEPTED) {
      const hasAcceptedQuote =
        lead.motorQuotations.some((q) => q.status === 'ACCEPTED') ||
        lead.quotations.some((q) => q.status === 'ACCEPTED');
      if (!hasAcceptedQuote) {
        throw new BadRequestException(
          'Cannot mark CUSTOMER_ACCEPTED until at least one quotation has been accepted by the customer.',
        );
      }
    }

    if (targetStatus === LeadStatus.CONVERTED) {
      const issuedPolicyCount = await this.prisma.policy.count({
        where: {
          OR: [{ quotation: { leadId } }, { motorQuotation: { leadId } }],
          status: 'ISSUED',
        },
      });

      if (issuedPolicyCount === 0) {
        throw new BadRequestException(
          'Lead cannot be CONVERTED before a valid policy has been officially ISSUED.',
        );
      }
    }

    return { valid: true, lead };
  }

  async transition(
    leadId: string,
    targetStatus: LeadStatus,
    actor: RequestUser,
    remarks?: string,
  ) {
    const { lead } = await this.validateTransition(leadId, targetStatus);
    const fromStage = lead.status;

    // Execute state change and write immutable audit history in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Update lead status
      const updatedLead = await tx.lead.update({
        where: { id: leadId },
        data: {
          status: targetStatus,
          updatedById: actor.id,
        },
      });

      // 2. Write stage history
      await tx.leadStageHistory.create({
        data: {
          leadId,
          fromStage,
          toStage: targetStatus,
          performedById: actor.id,
          performerRole: actor.role || 'AGENT',
          remarks: remarks || null,
        },
      });

      // 3. If transitioning to BACK_OFFICE, auto-create BackOfficeTask if none open
      if (targetStatus === LeadStatus.BACK_OFFICE) {
        const existingTask = await tx.backOfficeTask.findFirst({
          where: { leadId, status: { in: ['PENDING', 'IN_REVIEW'] } },
        });

        if (!existingTask) {
          const count = await tx.backOfficeTask.count();
          const taskCode = `BOT-${String(count + 1).padStart(5, '0')}`;
          await tx.backOfficeTask.create({
            data: {
              companyId: updatedLead.companyId,
              taskCode,
              taskType: 'POLICY_ISSUANCE',
              leadId,
              status: 'PENDING',
              priority: 'HIGH',
              verificationNotes:
                remarks ||
                'Awaiting Back Office policy verification and issuance',
              createdById: actor.id,
            },
          });
        }
      }

      return updatedLead;
    });

    return {
      success: true,
      leadId: result.id,
      fromStatus: fromStage,
      toStatus: targetStatus,
      leadCode: result.leadCode,
    };
  }
}
