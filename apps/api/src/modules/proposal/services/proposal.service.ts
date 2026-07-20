import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProposalStatus, PolicyStatus } from '@prisma/client';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';
import { WorkflowEngineService } from '../../platform/workflow/services/workflow-engine.service';

@Injectable()
export class ProposalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  private generatePropNumber(): string {
    return `PROP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async getProposals(userId?: string) {
    const where = userId ? { submittedById: userId } : {};
    return this.prisma.proposal.findMany({
      where,
      include: { contact: true, quotation: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProposalDetails(id: string, user: RequestUser) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        contact: true,
        quotation: true,
        documents: { include: { document: true } },
        histories: {
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!prop) {
      throw new NotFoundException('Proposal not found');
    }

    // BOLA ownership verification
    if (user.role === 'SALES_AGENT' && prop.submittedById !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this proposal',
      );
    }

    return prop;
  }

  async createProposal(quotationId: string, userId: string) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: quotationId },
    });

    if (!quotation) {
      throw new NotFoundException('Quotation not found');
    }

    const proposalNumber = this.generatePropNumber();

    return this.prisma.$transaction(async (tx) => {
      const proposal = await tx.proposal.create({
        data: {
          proposalNumber,
          quotationId,
          contactId: quotation.contactId,
          submittedById: userId,
          status: ProposalStatus.DRAFT,
        },
      });

      // Seed mandatory documents list
      const mandatoryDocs = [
        'RC',
        'Previous Policy',
        'Driving Licence',
        'PAN',
        'Aadhaar',
      ];
      for (const docName of mandatoryDocs) {
        await tx.proposalDocument.create({
          data: {
            proposalId: proposal.id,
            documentId: null, // Set to null instead of ''
            mandatory: true,
            verified: false,
            remarks: docName,
          },
        });
      }

      await tx.proposalHistory.create({
        data: {
          proposalId: proposal.id,
          status: ProposalStatus.DRAFT,
          comments: 'Proposal initialized as draft',
          performedById: userId,
        },
      });

      return proposal;
    });
  }

  async attachDocument(
    proposalId: string,
    checklistItemId: string,
    documentId: string,
    userId: string,
  ) {
    const propDoc = await this.prisma.proposalDocument.findUnique({
      where: { id: checklistItemId },
    });

    if (!propDoc || propDoc.proposalId !== proposalId) {
      throw new NotFoundException('Checklist item not found');
    }

    const updated = await this.prisma.proposalDocument.update({
      where: { id: checklistItemId },
      data: {
        documentId,
        verified: true,
      },
    });

    return updated;
  }

  async submitProposal(id: string, userId: string, expectedVersion?: number) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!prop) {
      throw new NotFoundException('Proposal not found');
    }

    const missingDocs = prop.documents.filter(
      (d) => d.mandatory && !d.documentId,
    );
    if (missingDocs.length > 0) {
      throw new BadRequestException(
        `Cannot submit proposal. Mandatory documents are missing: ${missingDocs.map((m) => m.remarks).join(', ')}`,
      );
    }

    if (expectedVersion !== undefined) {
      await checkOptimisticLock(this.prisma.proposal, id, expectedVersion);
    }

    const workflow = await this.prisma.workflow.findFirst({
      where: { module: 'PROPOSALS', active: true },
      include: {
        transitions: {
          include: { fromState: true, toState: true },
        },
      },
    });

    if (!workflow) {
      throw new BadRequestException(
        'Proposal workflow configuration not found',
      );
    }

    const transition = workflow.transitions.find(
      (t) => t.fromState?.code === 'DRAFT' && t.toState.code === 'SUBMITTED',
    );

    if (!transition) {
      throw new BadRequestException('Submit Proposal transition not found');
    }

    await this.workflowEngine.transition(
      'PROPOSAL',
      id,
      transition.id,
      userId,
      'Proposal submitted for underwriting review',
    );

    return this.prisma.proposal.findUnique({
      where: { id },
      include: { documents: true },
    });
  }

  async reviewProposal(
    id: string,
    approve: boolean,
    remarks: string,
    reviewerId: string,
    expectedVersion?: number,
  ) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: { quotation: true },
    });

    if (!prop) {
      throw new NotFoundException('Proposal not found');
    }

    if (
      prop.status === ProposalStatus.POLICY_ISSUED ||
      prop.status === ProposalStatus.APPROVED ||
      prop.status === ProposalStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Cannot review a proposal in status: ${prop.status}`,
      );
    }

    if (expectedVersion !== undefined) {
      await checkOptimisticLock(this.prisma.proposal, id, expectedVersion);
    }

    const workflow = await this.prisma.workflow.findFirst({
      where: { module: 'PROPOSALS', active: true },
      include: {
        transitions: {
          include: { fromState: true, toState: true },
        },
      },
    });

    if (!workflow) {
      throw new BadRequestException(
        'Proposal workflow configuration not found',
      );
    }

    const variables = {
      premiumAmount: Number(prop.quotation?.totalPremium) || 0,
      basePremium: Number(prop.quotation?.basePremium) || 0,
      status: prop.status,
    };

    let transitionToExecute;
    if (prop.status === ProposalStatus.SUBMITTED) {
      // Direct transition using Start Review
      transitionToExecute = workflow.transitions.find(
        (t) =>
          t.fromState?.code === 'SUBMITTED' &&
          t.toState.code === 'UNDER_REVIEW',
      );
    } else if (prop.status === ProposalStatus.UNDER_REVIEW) {
      if (approve) {
        transitionToExecute = workflow.transitions.find((t) => {
          if (
            t.fromState?.code !== 'UNDER_REVIEW' ||
            t.toState.code !== 'APPROVED'
          )
            return false;

          const conditions = t.conditions as any;
          if (!conditions) return true;

          const logic = conditions.logic || 'AND';
          const rules = conditions.rules || [];
          if (rules.length === 0) return true;

          if (logic === 'AND') {
            return rules.every((rule: any) => {
              const val = variables[rule.field];
              if (rule.operator === 'lte') return val <= rule.value;
              if (rule.operator === 'gt') return val > rule.value;
              return false;
            });
          }
          return false;
        });
      } else {
        transitionToExecute = workflow.transitions.find(
          (t) =>
            t.fromState?.code === 'UNDER_REVIEW' &&
            t.toState.code === 'REJECTED',
        );
      }
    }

    if (!transitionToExecute) {
      throw new BadRequestException(
        `No valid transition path found for proposal in status ${prop.status}`,
      );
    }

    await this.workflowEngine.transition(
      'PROPOSAL',
      id,
      transitionToExecute.id,
      reviewerId,
      remarks || (approve ? 'Proposal approved' : 'Proposal rejected'),
    );

    const updatedProposal = await this.prisma.proposal.findUnique({
      where: { id },
    });

    const policy = await this.prisma.policy.findFirst({
      where: { proposalId: id },
    });

    return {
      proposal: updatedProposal,
      policy,
      message: approve ? 'Policy issued successfully' : 'Proposal rejected',
    };
  }
}
