import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimMapper } from '../../mappers/claim.mapper';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../../common/services/scope-resolver.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

@Injectable()
export class GetClaimsService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  async executeOne(id: string, user: ActorContext) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'CLAIM', 'READ', claim);

    return ClaimMapper.toResponse(claim);
  }

  async executeAll(pagination: PaginationDto, user: ActorContext) {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' } = pagination;
    const skip = (page - 1) * limit;
    
    const scopedFilter = this.scopeResolver.resolveScopeFilter(user, 'CLAIM');
    const claims = await this.claimRepository.findAll(skip, limit, scopedFilter, { [sortBy]: sortOrder });
    const total = await this.claimRepository.count(scopedFilter);
    
    return new PaginatedResponseDto(ClaimMapper.toResponseList(claims), total, page, limit);
  }
}

