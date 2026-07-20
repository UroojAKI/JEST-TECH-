import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class ApproveQuotationService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async execute(id: string, comments: string, approvedById: string) {
    const existing = await this.quotationRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    if (
      existing.status !== QuotationStatus.PENDING_APPROVAL &&
      existing.status !== QuotationStatus.DRAFT
    ) {
      throw new BadRequestException(
        `Cannot approve quotation in status ${existing.status}. Must be DRAFT or PENDING_APPROVAL.`,
      );
    }

    const updated = await this.quotationRepository.update(id, {
      status: QuotationStatus.APPROVED,
      updatedBy: { connect: { id: approvedById } },
    });

    await this.quotationRepository.addHistoryEntry(
      id,
      QuotationStatus.APPROVED,
      comments || 'Quotation approved.',
      approvedById,
    );

    const finalQuotation = await this.quotationRepository.findDetail(id);
    return QuotationMapper.toResponse(finalQuotation!);
  }
}
