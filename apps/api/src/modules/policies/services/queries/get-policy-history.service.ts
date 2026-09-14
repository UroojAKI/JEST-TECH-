import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';

@Injectable()
export class GetPolicyHistoryService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly authzService: ResourceAuthorizationService,
  ) {}

  async execute(policyId: string, user: ActorContext) {
    const p = await this.policyRepository.findDetail(policyId);
    if (!p || p.deletedAt) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

    // Enforce object-level access control (IDOR Prevention)
    this.authzService.authorize(user, 'POLICY', 'READ', p);

    const histories = await this.policyRepository.findHistory(policyId);
    return histories.map((h) => ({
      id: h.id,
      status: h.status,
      comments: h.comments,
      createdById: h.createdById,
      createdAt: h.createdAt,
    }));
  }
}
