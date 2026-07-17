import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ProposalStatus, PolicyStatus } from '@prisma/client';

@Injectable()
export class ProposalService {
  constructor(private readonly prisma: PrismaService) {}

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

  async getProposalDetails(id: string) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: {
        contact: true,
        quotation: true,
        documents: { include: { document: true } },
        histories: { include: { performedBy: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!prop) {
      throw new NotFoundException('Proposal not found');
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

    const proposal = await this.prisma.proposal.create({
      data: {
        proposalNumber,
        quotationId,
        contactId: quotation.contactId,
        submittedById: userId,
        status: ProposalStatus.DRAFT,
      },
    });

    // Seed mandatory documents list
    const mandatoryDocs = ['RC', 'Previous Policy', 'Driving Licence', 'PAN', 'Aadhaar'];
    for (const docName of mandatoryDocs) {
      await this.prisma.proposalDocument.create({
        data: {
          proposalId: proposal.id,
          documentId: '', // Placeholder
          mandatory: true,
          verified: false,
          remarks: docName,
        },
      });
    }

    await this.prisma.proposalHistory.create({
      data: {
        proposalId: proposal.id,
        status: ProposalStatus.DRAFT,
        comments: 'Proposal initialized as draft',
        performedById: userId,
      },
    });

    return proposal;
  }

  async attachDocument(proposalId: string, checklistItemId: string, documentId: string, userId: string) {
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

  async submitProposal(id: string, userId: string) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: { documents: true },
    });

    if (!prop) {
      throw new NotFoundException('Proposal not found');
    }

    const missingDocs = prop.documents.filter((d) => d.mandatory && !d.documentId);
    if (missingDocs.length > 0) {
      throw new BadRequestException(`Cannot submit proposal. Mandatory documents are missing: ${missingDocs.map(m => m.remarks).join(', ')}`);
    }

    const updated = await this.prisma.proposal.update({
      where: { id },
      data: {
        status: ProposalStatus.SUBMITTED,
        submittedAt: new Date(),
      },
    });

    await this.prisma.proposalHistory.create({
      data: {
        proposalId: id,
        status: ProposalStatus.SUBMITTED,
        comments: 'Proposal submitted for underwriting review',
        performedById: userId,
      },
    });

    return updated;
  }

  async reviewProposal(id: string, approve: boolean, remarks: string, reviewerId: string) {
    const prop = await this.prisma.proposal.findUnique({
      where: { id },
      include: { quotation: true },
    });

    if (!prop) {
      throw new NotFoundException('Proposal not found');
    }

    if (approve) {
      await this.prisma.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.APPROVED,
          approvedById: reviewerId,
          approvedAt: new Date(),
        },
      });

      await this.prisma.proposalHistory.create({
        data: {
          proposalId: id,
          status: ProposalStatus.APPROVED,
          comments: remarks || 'Proposal approved by Underwriter',
          performedById: reviewerId,
        },
      });

      // Issue policy
      const policyNumber = `POL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const policy = await this.prisma.policy.create({
        data: {
          policyNumber,
          status: PolicyStatus.ACTIVE,
          quotationId: prop.quotationId,
          contactId: prop.contactId,
          premiumAmount: prop.quotation.totalPremium,
          effectiveDate: new Date(),
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          proposalId: prop.id,
        },
      });

      await this.prisma.proposal.update({
        where: { id },
        data: { status: ProposalStatus.POLICY_ISSUED },
      });

      return { proposal: prop, policy, message: 'Policy issued successfully' };
    } else {
      const updated = await this.prisma.proposal.update({
        where: { id },
        data: {
          status: ProposalStatus.REJECTED,
          rejectedReason: remarks,
        },
      });

      await this.prisma.proposalHistory.create({
        data: {
          proposalId: id,
          status: ProposalStatus.REJECTED,
          comments: remarks || 'Proposal rejected by Underwriter',
          performedById: reviewerId,
        },
      });

      return { proposal: updated, message: 'Proposal rejected' };
    }
  }
}
