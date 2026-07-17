import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { ComparisonService } from '../../engine/comparison.service';

@Injectable()
export class CompareQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly comparisonService: ComparisonService,
  ) {}

  async execute(ids: string[]) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException('At least one quotation ID must be provided for comparison');
    }

    const quotations = await Promise.all(
      ids.map(async (id) => {
        const q = await this.quotationRepository.findById(id);
        if (!q || q.deletedAt) {
          throw new NotFoundException(`Quotation with ID ${id} not found`);
        }
        return QuotationMapper.toResponse(q);
      }),
    );

    return this.comparisonService.compare(quotations);
  }
}
