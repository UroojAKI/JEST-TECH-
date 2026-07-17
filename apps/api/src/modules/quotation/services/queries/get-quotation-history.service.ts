import { Injectable, NotFoundException } from '@nestjs/common';

import { QuotationRepository } from '../../repositories/quotation.repository';

@Injectable()
export class GetQuotationHistoryService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async execute(quotationId: string) {
    const q = await this.quotationRepository.findById(quotationId);
    if (!q || q.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${quotationId} not found`);
    }

    const histories = await this.quotationRepository.findHistory(quotationId);
    return histories.map((h) => ({
      id: h.id,
      status: h.status,
      comments: h.comments,
      createdById: h.createdById,
      createdAt: h.createdAt,
    }));
  }
}
