import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../../common/services/scope-resolver.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { PaginatedResponseDto } from '../../../../common/pagination/paginated-response.dto';

@Injectable()
export class GetPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly authzService: ResourceAuthorizationService,
    private readonly scopeResolver: ScopeResolver,
  ) {}

  async executeOne(id: string, user: ActorContext) {
    const policy = await this.policyRepository.findDetail(id);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    // Authoritative Universal Resource Authorization check
    this.authzService.authorize(user, 'POLICY', 'READ', policy);

    return PolicyMapper.toResponse(policy);
  }

  async executeAll(pagination: PaginationDto, user: ActorContext) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(user, 'POLICY');
    const result = await this.policyRepository.findPaginated(
      pagination,
      scopedFilter,
    );
    const page = pagination.page || result.meta?.page || 1;
    const limit = pagination.limit || result.meta?.limit || 25;
    const total = result.meta?.total ?? result.data?.length ?? 0;
    const mappedItems = PolicyMapper.toResponseList(result.data as any);
    return new PaginatedResponseDto(
      mappedItems,
      total,
      page,
      limit,
    );
  }
}
