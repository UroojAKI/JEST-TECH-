import { Injectable, NotFoundException } from '@nestjs/common';

import { PolicyRepository } from '../../repositories/policy.repository';

@Injectable()
export class GetPolicyHistoryService {
  constructor(private readonly policyRepository: PolicyRepository) {}

  async execute(policyId: string) {
    const p = await this.policyRepository.findById(policyId);
    if (!p || p.deletedAt) {
      throw new NotFoundException(`Policy with ID ${policyId} not found`);
    }

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
