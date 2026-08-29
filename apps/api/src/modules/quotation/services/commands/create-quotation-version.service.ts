import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

export interface CreateQuotationVersionInputDto {
  sumInsured: number;
  basePremium: number;
  gstAmount?: number;
  totalPremium?: number;
  discountAmount?: number;
  metadata?: Record<string, any>;
  addons?: Array<{ addonCode: string; addonName: string; premium: number }>;
}

@Injectable()
export class CreateQuotationVersionService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Creates an immutable new version snapshot (V2, V3...) under an existing quotation.
   * G006: Tracks multi-version quotes with immutable snapshots per version.
   */
  async execute(
    id: string,
    dto: CreateQuotationVersionInputDto,
    createdById: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
        include: { versions: { orderBy: { versionNumber: 'desc' } } },
      });

      if (!quotation) {
        throw new NotFoundException(`Quotation with ID ${id} not found`);
      }

      if (quotation.status === QuotationStatus.APPROVED) {
        throw new BadRequestException(
          'Cannot add new version to an accepted quotation. Supersede or revoke acceptance first.',
        );
      }

      if (quotation.status === QuotationStatus.CONVERTED_TO_POLICY) {
        throw new BadRequestException(
          'Cannot revise a quotation that has already been converted to a policy.',
        );
      }

      // Calculate next version number
      const highestVersion = quotation.versions?.[0]?.versionNumber || 1;
      const nextVersionNumber = highestVersion + 1;

      // Monetary math validation
      const sumInsured = new Prisma.Decimal(dto.sumInsured);
      const basePremium = new Prisma.Decimal(dto.basePremium);
      const discountAmount = new Prisma.Decimal(dto.discountAmount || 0);
      const netBase = Math.max(0, dto.basePremium - (dto.discountAmount || 0));
      const gstAmount =
        dto.gstAmount !== undefined
          ? new Prisma.Decimal(dto.gstAmount)
          : new Prisma.Decimal(Math.round(netBase * 0.18));
      const totalPremium =
        dto.totalPremium !== undefined
          ? new Prisma.Decimal(dto.totalPremium)
          : new Prisma.Decimal(netBase + Number(gstAmount));

      // 1. Create immutable QuotationVersion row
      await tx.quotationVersion.create({
        data: {
          quotationId: id,
          versionNumber: nextVersionNumber,
          sumInsured,
          basePremium,
          discountAmount,
          gstAmount,
          totalPremium,
          metadata: {
            ...dto.metadata,
            addons: dto.addons || [],
            revisionDate: new Date().toISOString(),
          },
          createdById,
        },
      });

      // 2. Update parent Quotation with current active version numbers
      await tx.quotation.update({
        where: { id },
        data: {
          sumInsured,
          basePremium,
          discountAmount,
          gstAmount,
          totalPremium,
          version: quotation.version + 1,
          updatedById: createdById,
        },
      });

      // 3. Record audit history
      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: quotation.status,
          comments: `Generated revised quotation version V${nextVersionNumber}. Total: ₹${Number(totalPremium).toLocaleString('en-IN')}`,
          createdById,
        },
      });

      const updated = await tx.quotation.findFirst({
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

      return QuotationMapper.toResponse(updated as any);
    });
  }
}
