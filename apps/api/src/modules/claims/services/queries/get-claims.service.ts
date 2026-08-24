import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimMapper } from '../../mappers/claim.mapper';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

@Injectable()
export class GetClaimsService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async executeOne(id: string, user: RequestUser) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    // BOLA ownership verification
    if (
      (user.role === 'SALES_AGENT' || user.role === 'CUSTOMER') &&
      claim.createdById !== user.id
    ) {
      throw new ForbiddenException(
        'You do not have permission to access this claim',
      );
    }

    return ClaimMapper.toResponse(claim);
  }

  async executeAll(pagination: PaginationDto, user: RequestUser) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    
    const where =
      user.role === 'SALES_AGENT' || user.role === 'CUSTOMER'
        ? { createdById: user.id }
        : {};
        
    const claims = await this.claimRepository.findAll(skip, limit, where, { [sortBy]: sortOrder });
    const total = await this.claimRepository.count(where);
    
    return new PaginatedResponseDto(ClaimMapper.toResponseList(claims), total, page, limit);
  }
}
