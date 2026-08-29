import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export const WORKFLOW_STAGES = [
  'ASSIGNED',
  'CONTACTED',
  'NEED_ANALYSIS',
  'QUOTATION',
  'PROPOSAL',
  'NEGOTIATION',
  'PAYMENT',
  'ISSUED',
  'REFERRAL',
  'CRM_UPDATED',
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

@Injectable()
export class LeadWorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate stage prerequisites according to standard SOP rules.
   */
  async validateStagePrerequisites(
    leadId: string,
    targetStage: WorkflowStage,
  ): Promise<{ isMet: boolean; missingRules: string[] }> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        contact: true,
        callLogs: true,
        meetingLogs: true,
        activities: true,
        notes: true,
        quotations: true,
        stageHistory: true,
        referrals: true,
      },
    });

    if (!lead) throw new NotFoundException(`Lead '${leadId}' not found`);

    const missingRules: string[] = [];

    switch (targetStage) {
      case 'CONTACTED': {
        const hasInteractions =
          lead.callLogs.length > 0 ||
          lead.meetingLogs.length > 0 ||
          lead.activities.length > 0;
        if (!hasInteractions) {
          missingRules.push(
            'At least one call, meeting, or activity log must be recorded before moving to CONTACTED',
          );
        }
        break;
      }
      case 'NEED_ANALYSIS': {
        if (!lead.contact?.phone && !lead.contact?.email) {
          missingRules.push(
            'Customer phone or email is required for NEED_ANALYSIS',
          );
        }
        break;
      }
      case 'QUOTATION': {
        const hasQuotes = lead.quotations && lead.quotations.length > 0;
        if (!hasQuotes) {
          missingRules.push(
            'At least one quotation must be generated before moving to QUOTATION stage',
          );
        }
        break;
      }
      case 'PROPOSAL': {
        const validQuote = lead.quotations.find(
          (q) => q.status === 'APPROVED' || q.status === 'DRAFT',
        );
        if (!validQuote) {
          missingRules.push(
            'A valid prepared quotation must be available before generating a PROPOSAL',
          );
        }
        break;
      }
      case 'NEGOTIATION': {
        const hasNotes =
          lead.activities.some(
            (a) => a.type === 'MEETING' || a.type === 'CALL',
          ) ||
          (lead.notes && lead.notes.length > 0);
        if (!hasNotes) {
          missingRules.push(
            'Negotiation notes or follow-up activity must be recorded',
          );
        }
        break;
      }
      case 'PAYMENT': {
        if (lead.status === 'UNQUALIFIED' || lead.status === 'LOST') {
          missingRules.push(
            'Cannot process payment for an unqualified or lost lead',
          );
        }
        break;
      }
      case 'ISSUED': {
        const paid =
          lead.status === 'PAYMENT_RECEIVED' ||
          lead.status === 'POLICY_ISSUED' ||
          lead.currentWorkflowStep === 'PAYMENT';
        if (!paid) {
          missingRules.push(
            'Payment verification is required before policy issuance',
          );
        }
        break;
      }
      case 'REFERRAL': {
        const hasReferralOrExemption =
          lead.referrals.length > 0 || !!lead.noReferralReason;
        if (!hasReferralOrExemption) {
          missingRules.push(
            'Referral must be captured or explicitly marked "No Referral" with a reason',
          );
        }
        break;
      }
      case 'CRM_UPDATED': {
        if (
          !lead.crmUpdatedAt &&
          lead.currentWorkflowStep !== 'REFERRAL' &&
          lead.currentWorkflowStep !== 'ISSUED'
        ) {
          missingRules.push(
            'Policy issuance and referral review must be completed prior to final CRM update',
          );
        }
        break;
      }
      default:
        break;
    }

    return {
      isMet: missingRules.length === 0,
      missingRules,
    };
  }

  /**
   * Move lead workflow stage enforcing Controlled Sequential Workflow:
   * - SALES_AGENT: Strict sequential forward progression (+1 step).
   * - BRANCH_MANAGER / SUPER_ADMIN: Can skip forward or move backward with mandatory overrideReason.
   */
  async transitionStage(
    leadId: string,
    targetStage: WorkflowStage,
    user: { id: string; role: string },
    overrideReason?: string,
    remarks?: string,
  ) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead)
      throw new NotFoundException(`Lead with ID '${leadId}' not found`);

    const currentStage = (lead.currentWorkflowStep ||
      'ASSIGNED') as WorkflowStage;
    const currentIndex = WORKFLOW_STAGES.indexOf(currentStage);
    const targetIndex = WORKFLOW_STAGES.indexOf(targetStage);

    if (targetIndex === -1) {
      throw new BadRequestException(
        `Invalid target workflow stage '${targetStage}'`,
      );
    }

    const isSalesAgent = user.role === 'SALES_AGENT';
    const isManagerOrAdmin =
      user.role === 'BRANCH_MANAGER' ||
      user.role === 'TEAM_LEADER' ||
      user.role === 'SUPER_ADMIN' ||
      user.role === 'ADMIN';

    let isOverride = false;

    // 1. Role Transition Matrix Check
    if (isSalesAgent) {
      if (targetIndex !== currentIndex + 1) {
        throw new ForbiddenException(
          `Sales Executives can only move sequentially to the immediate next step (${
            WORKFLOW_STAGES[currentIndex + 1] || 'COMPLETED'
          }). Skipping or backward transitions require Sales Manager override.`,
        );
      }
    } else if (isManagerOrAdmin) {
      if (targetIndex !== currentIndex + 1) {
        isOverride = true;
        if (!overrideReason || overrideReason.trim().length < 5) {
          throw new BadRequestException(
            `Sales Manager override requires a mandatory override reason (minimum 5 characters).`,
          );
        }
      }
    }

    // 2. Validate Prerequisites
    const prereqs = await this.validateStagePrerequisites(leadId, targetStage);
    if (!prereqs.isMet && !isOverride) {
      throw new BadRequestException(
        `Stage prerequisites not met: ${prereqs.missingRules.join('; ')}`,
      );
    }

    // 3. Update Lead and Log Stage History
    const updatedLead = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        currentWorkflowStep: targetStage,
        crmUpdatedAt:
          targetStage === 'CRM_UPDATED' ? new Date() : lead.crmUpdatedAt,
        status:
          targetStage === 'ISSUED' || targetStage === 'CRM_UPDATED'
            ? 'POLICY_ISSUED'
            : targetStage === 'PAYMENT'
              ? 'PAYMENT_RECEIVED'
              : targetStage === 'QUOTATION' || targetStage === 'PROPOSAL'
                ? 'QUOTE_PREPARED'
                : lead.status,
      },
    });

    await this.prisma.leadStageHistory.create({
      data: {
        leadId,
        fromStage: currentStage,
        toStage: targetStage,
        performedById: user.id,
        performerRole: user.role,
        isOverride,
        overrideReason: isOverride ? overrideReason : null,
        remarks: remarks || null,
        prerequisitesMet: prereqs.isMet
          ? { met: true }
          : { met: false, missing: prereqs.missingRules },
      },
    });

    return {
      lead: updatedLead,
      fromStage: currentStage,
      toStage: targetStage,
      isOverride,
      prerequisites: prereqs,
    };
  }

  async getStageHistory(leadId: string) {
    return this.prisma.leadStageHistory.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            designation: true,
          },
        },
      },
    });
  }
}
