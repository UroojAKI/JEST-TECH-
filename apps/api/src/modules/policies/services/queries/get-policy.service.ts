import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';

@Injectable()
export class GetPolicyService {
  constructor(private readonly policyRepository: PolicyRepository) {}

  async executeOne(id: string, user: RequestUser) {
    const policy = await this.policyRepository.findDetail(id);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    // BOLA ownership verification
    if (user.role === 'SALES_AGENT' && policy.createdById !== user.id) {
      throw new ForbiddenException(
        'You do not have permission to access this policy',
      );
    }

    return PolicyMapper.toResponse(policy);
  }

  async executeAll(user: RequestUser) {
    const whereClause =
      user.role === 'SALES_AGENT' ? { createdById: user.id } : {};
    return this.policyRepository.findPaginated(
      { page: 1, limit: 100 },
      whereClause,
    );
  }
}
