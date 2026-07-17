import { Injectable, NotFoundException } from '@nestjs/common';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class GetQuotationService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async executeOne(id: string) {
    const quotation = await this.quotationRepository.findById(id);
    if (!quotation || quotation.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }
    return QuotationMapper.toResponse(quotation);
  }

  async executeAll() {
    const list = await this.quotationRepository.findAll();
    return QuotationMapper.toResponseList(list);
  }
}
