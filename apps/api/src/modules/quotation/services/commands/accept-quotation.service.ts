import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  QuotationStatus,
  MotorWorkflowState,
  IssuanceStatus,
} from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { CustomerAcceptanceDto, CustomerAcceptanceMethod } from '../../dto/customer-acceptance.dto';

@Injectable()
export class AcceptQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Customer acceptance of a quotation version.
   * G006 & Contract 02 §2 & WP-05: Enforces that exactly ONE quotation version can be accepted per lead group.
   * Records agentId, timestamp, quotationVersion, selectedGstRate, and evidenceMethod.
   * Supercedes/rejects competing draft versions under the same lead.
   */
  async execute(id: string, actorId: string, commentsOrDto?: string | CustomerAcceptanceDto) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
      });

      if (!quotation) {
        throw new NotFoundException(`Quotation with ID ${id} not found`);
      }

      if (
        quotation.status === QuotationStatus.REJECTED ||
        quotation.status === QuotationStatus.EXPIRED
      ) {
        throw new BadRequestException(
          `Cannot accept quotation in ${quotation.status} state. Only active draft quotations can be accepted.`,
        );
      }

      if (quotation.status === QuotationStatus.CONVERTED_TO_POLICY) {
        throw new BadRequestException(
          'Quotation has already been converted to a policy.',
        );
      }

      // If already accepted, return idempotently
      if (
        quotation.status === QuotationStatus.APPROVED &&
        quotation.workflowState === MotorWorkflowState.READY_FOR_PROPOSAL
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
            status: {
              in: [QuotationStatus.DRAFT, QuotationStatus.PENDING_APPROVAL],
            },
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

      const dto: Partial<CustomerAcceptanceDto> =
        typeof commentsOrDto === 'object' && commentsOrDto !== null
          ? commentsOrDto
          : { comments: typeof commentsOrDto === 'string' ? commentsOrDto : undefined };

      const evidenceMethod = dto.evidenceMethod || CustomerAcceptanceMethod.PORTAL_CLICK;
      const evidenceReference = dto.evidenceReference || null;
      const quotationVersion = quotation.calculationVersion || '1.0';
      const selectedGstRate =
        dto.selectedGstRate ||
        (quotation.calculationSnapshot as any)?.rateConfig?.gstRatePercent ||
        18;
      const acceptanceTimestamp = new Date().toISOString();

      const customerAcceptanceRecord = {
        agentId: actorId,
        timestamp: acceptanceTimestamp,
        quotationVersion,
        selectedGstRate,
        evidenceMethod,
        evidenceReference,
        comments: dto.comments || null,
      };

      const existingMetadata = (quotation.motorMetadata as Record<string, any>) || {};
      const updatedMetadata = {
        ...existingMetadata,
        customerAcceptance: customerAcceptanceRecord,
      };

      // Mark this quotation as ACCEPTED (APPROVED + READY_FOR_PROPOSAL)
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.APPROVED,
          workflowState: MotorWorkflowState.READY_FOR_PROPOSAL,
          issuanceStatus: IssuanceStatus.PROPOSAL_READY,
          motorMetadata: updatedMetadata,
          updatedById: actorId,
        },
      });

      const auditComment =
        dto.comments ||
        `Customer accepted quotation version ${quotationVersion} via ${evidenceMethod}${
          evidenceReference ? ` (Ref: ${evidenceReference})` : ''
        } with ${selectedGstRate}% GST.`;

      // Record audit history
      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: QuotationStatus.APPROVED,
          comments: auditComment,
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
