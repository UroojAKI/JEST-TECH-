import { Injectable, NotFoundException } from '@nestjs/common';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class GetQuotationService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async executeOne(id: string) {
    const quotation = await this.quotationRepository.findDetail(id);
    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }
    return QuotationMapper.toResponse(quotation);
  }

  async executeAll() {
    return this.quotationRepository.findPaginated({ page: 1, limit: 100 });
  }
}
