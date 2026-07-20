import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PolicyStatus } from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { PolicyDomainService } from '../../domain/policy.domain-service';

@Injectable()
export class CancelPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly policyDomainService: PolicyDomainService,
  ) {}

  async execute(id: string, comments: string, cancelledById: string) {
    const existing = await this.policyRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Policy with ID ${id} not found`);
    }

    // Delegate status transition validation to PolicyDomainService
    this.policyDomainService.validateCancellation(existing.status);

    const updated = await this.policyRepository.update(id, {
      status: PolicyStatus.CANCELLED,
      updatedBy: { connect: { id: cancelledById } },
    });

    await this.policyRepository.addHistoryEntry(
      id,
      PolicyStatus.CANCELLED,
      comments || 'Policy cancelled by authorized personnel.',
      cancelledById,
    );

    const finalPolicy = await this.policyRepository.findDetail(id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
