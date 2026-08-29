import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ScopeResolver } from '../../../../common/services/scope-resolver.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';

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
    return this.policyRepository.findPaginated(pagination, scopedFilter);
  }
}
