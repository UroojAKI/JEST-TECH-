import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';

@Injectable()
export class GetPolicyService {
  constructor(private readonly policyRepository: PolicyRepository) {}

  async executeOne(id: string) {
    const policy = await this.policyRepository.findById(id);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }
    return PolicyMapper.toResponse(policy);
  }

  async executeAll() {
    const list = await this.policyRepository.findAll();
    return PolicyMapper.toResponseList(list);
  }
}
