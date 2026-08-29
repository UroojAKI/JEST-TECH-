import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PolicyStatus } from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { PolicyDomainService } from '../../domain/policy.domain-service';

import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class CancelPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(id: string, comments: string, cancelledById: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.policy.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Policy with ID ${id} not found`);
      }

      // Delegate status transition validation to PolicyDomainService
      this.policyDomainService.validateCancellation(existing.status);

      await tx.policy.update({
        where: { id },
        data: {
          status: PolicyStatus.CANCELLED,
          version: { increment: 1 },
          updatedBy: { connect: { id: cancelledById } },
        },
      });

      await tx.policyHistory.create({
        data: {
          policyId: id,
          status: PolicyStatus.CANCELLED,
          comments: comments || 'Policy cancelled by authorized personnel.',
          createdById: cancelledById,
        },
      });

      const finalPolicy = await this.policyRepository.findDetail(id);
      return PolicyMapper.toResponse(finalPolicy!);
    });
  }
}
