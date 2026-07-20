import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class GetQuotationService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async executeOne(id: string, user: RequestUser) {
    const quotation = await this.quotationRepository.findDetail(id);
    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    if (user.role === 'SALES_AGENT' && quotation.createdById !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this quotation',
      );
    }

    return QuotationMapper.toResponse(quotation);
  }

  async executeAll(user: RequestUser) {
    const whereClause =
      user.role === 'SALES_AGENT' ? { createdById: user.id } : {};
    return this.quotationRepository.findPaginated(
      { page: 1, limit: 100 },
      whereClause,
    );
  }
}
