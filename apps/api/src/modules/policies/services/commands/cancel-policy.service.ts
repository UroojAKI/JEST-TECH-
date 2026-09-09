import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, PolicyStatus } from '@prisma/client';

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
    if (!comments || !comments.trim()) {
      throw new BadRequestException('A cancellation reason is strictly mandatory to cancel a policy.');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.policy.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Policy with ID ${id} not found`);
      }

      // Delegate status transition validation to PolicyDomainService (only ACTIVE/ISSUED can be cancelled)
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
          comments: comments.trim(),
          createdById: cancelledById,
        },
      });

      // EPIC-24: Audit Log for cancellation
      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: 'Policy',
          entityId: id,
          module: 'POLICIES',
          userId: cancelledById,
          performedById: cancelledById,
          oldValue: { status: existing.status },
          newValue: { status: PolicyStatus.CANCELLED, reason: comments.trim() },
        },
      });

      // EPIC-24: Transactional Outbox event for policy cancellation
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'POLICY',
          aggregateId: id,
          eventType: 'policy.cancelled',
          payload: {
            policyId: id,
            policyNumber: existing.policyNumber,
            previousStatus: existing.status,
            cancellationReason: comments.trim(),
            cancelledById,
            cancelledAt: new Date().toISOString(),
          },
          status: 'PENDING',
          attempts: 0,
          maxAttempts: 5,
        },
      });

      const finalPolicy = await tx.policy.findFirst({
        where: { id },
        include: {
          contact: true,
          account: true,
          histories: { orderBy: { createdAt: 'desc' } },
        },
      });
      return PolicyMapper.toResponse(finalPolicy as any);
    });
  }
}
