import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

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

  async executeAll(user: RequestUser, pagination: PaginationDto) {
    const { page = 1, limit = 10, search, sortBy = 'createdAt', sortOrder = 'desc', productType } = pagination;
    const skip = (page - 1) * limit;

    const whereClause: any = user.role === 'SALES_AGENT' ? { createdById: user.id } : {};
    
    if (productType) {
      whereClause.productType = productType;
    }
    
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { quotationCode: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [data, total] = await this.quotationRepository.findAll(
      skip,
      limit,
      whereClause,
      { [sortBy]: sortOrder },
    );
    return new PaginatedResponseDto(data.map(QuotationMapper.toResponse), total, page, limit);
  }
}
