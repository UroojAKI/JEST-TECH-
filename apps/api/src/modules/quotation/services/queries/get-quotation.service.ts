import { Injectable, NotFoundException } from '@nestjs/common';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../../common/services/scope-resolver.service';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

@Injectable()
export class GetQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  async executeOne(id: string, user: ActorContext) {
    const quotation = await this.quotationRepository.findDetail(id);
    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'QUOTATION', 'READ', quotation);

    return QuotationMapper.toResponse(quotation);
  }

  async executeAll(user: ActorContext, pagination: PaginationDto) {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      productType,
    } = pagination;
    const skip = (page - 1) * limit;

    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user,
      'QUOTATION',
    );
    const whereClause: any = { ...scopedFilter };

    if (productType) {
      whereClause.productType = productType;
    }

    if (search) {
      whereClause.AND = [
        ...(whereClause.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { quotationCode: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [quotations, total] = await this.quotationRepository.findAll(
      skip,
      limit,
      whereClause,
      { [sortBy]: sortOrder },
    );

    return new PaginatedResponseDto(
      QuotationMapper.toResponseList(quotations),
      total,
      page,
      limit,
    );
  }
}
