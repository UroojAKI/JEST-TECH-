import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuotationStatus, MotorWorkflowState, IssuanceStatus } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class AcceptQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Customer acceptance of a quotation version.
   * G006 & Contract 02 §2: Enforces that exactly ONE quotation version can be accepted per lead group.
   * Supercedes/rejects competing draft versions under the same lead.
   */
  async execute(id: string, actorId: string, comments?: string) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
      });

      if (!quotation) {
        throw new NotFoundException(`Quotation with ID ${id} not found`);
      }

      if (quotation.status === QuotationStatus.REJECTED || quotation.status === QuotationStatus.EXPIRED) {
        throw new BadRequestException(
          `Cannot accept quotation in ${quotation.status} state. Only active draft quotations can be accepted.`,
        );
      }

      if (quotation.status === QuotationStatus.CONVERTED_TO_POLICY) {
        throw new BadRequestException('Quotation has already been converted to a policy.');
      }

      // If already accepted, return idempotently
      if (
        quotation.status === QuotationStatus.APPROVED &&
        quotation.workflowState === MotorWorkflowState.QUOTE_FINALIZED
      ) {
        const detail = await this.quotationRepository.findDetail(id);
        return QuotationMapper.toResponse(detail!);
      }

      // Check if another quotation for this lead is already accepted
      if (quotation.leadId) {
        const existingAccepted = await tx.quotation.findFirst({
          where: {
            leadId: quotation.leadId,
            status: QuotationStatus.APPROVED,
            id: { not: quotation.id },
            deletedAt: null,
          },
        });

        if (existingAccepted) {
          throw new BadRequestException(
            `Lead already has an accepted quotation (${existingAccepted.quotationCode}). Only one quotation can be accepted per opportunity.`,
          );
        }

        // Supersede competing open quotes under this lead
        await tx.quotation.updateMany({
          where: {
            leadId: quotation.leadId,
            id: { not: quotation.id },
            status: { in: [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL] },
            deletedAt: null,
          },
          data: {
            status: QuotationStatus.REJECTED,
            updatedById: actorId,
          },
        });

        // Advance Lead to QUALIFIED status
        await tx.lead.update({
          where: { id: quotation.leadId },
          data: {
            status: 'QUALIFIED',
            updatedById: actorId,
          },
        });
      }

      // Mark this quotation as ACCEPTED (APPROVED + QUOTE_FINALIZED)
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.APPROVED,
          workflowState: MotorWorkflowState.QUOTE_FINALIZED,
          issuanceStatus: IssuanceStatus.PROPOSAL_READY,
          updatedById: actorId,
        },
      });

      // Record audit history
      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: QuotationStatus.APPROVED,
          comments: comments || 'Customer accepted quotation version. Opportunity qualified.',
          createdById: actorId,
        },
      });

      const finalDetail = await tx.quotation.findFirst({
        where: { id },
        include: {
          contact: true,
          account: true,
          lead: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          addons: true,
          discounts: true,
          histories: { orderBy: { createdAt: 'desc' } },
          documents: true,
        },
      });

      return QuotationMapper.toResponse(finalDetail as any);
    });
  }
}
