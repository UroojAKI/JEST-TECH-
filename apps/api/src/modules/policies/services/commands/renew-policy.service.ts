import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PolicyStatus } from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { RenewPolicyDto } from '../../dto/renew-policy.dto';
import { PolicyDomainService } from '../../domain/policy.domain-service';
import { Money } from '../../../../common/domain/value-objects/money.value-object';

import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class RenewPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(id: string, dto: RenewPolicyDto, renewedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.policy.findFirst({
        where: { id, deletedAt: null },
      });
      if (!existing) {
        throw new NotFoundException(`Policy with ID ${id} not found`);
      }

      const previousExpiry = existing.expiryDate;
      const newExpiryDate = new Date(dto.newExpiry);

      // Delegate validation to PolicyDomainService
      this.policyDomainService.validateRenewal(
        existing.status,
        previousExpiry,
        newExpiryDate,
        dto.premiumAmount,
      );

      // 1. Update Policy Expiry, Status and Increment Version
      await tx.policy.update({
        where: { id },
        data: {
          status: PolicyStatus.ACTIVE,
          expiryDate: newExpiryDate,
          version: { increment: 1 },
          updatedBy: { connect: { id: renewedById } },
        },
      });

      // 2. Add PolicyRenewal Record
      await tx.policyRenewal.create({
        data: {
          policyId: id,
          renewalNumber: dto.renewalNumber,
          previousExpiry,
          newExpiry: newExpiryDate,
          premiumAmount: Money.from(dto.premiumAmount).value,
        },
      });

      // 3. Log History Entry
      await tx.policyHistory.create({
        data: {
          policyId: id,
          status: 'RENEWAL',
          comments: `Policy renewed successfully. Renewal Number: ${dto.renewalNumber}. New Expiry: ${newExpiryDate.toISOString()}`,
          createdById: renewedById,
        },
      });

      const finalPolicy = await this.policyRepository.findDetail(id);
      return PolicyMapper.toResponse(finalPolicy!);
    });
  }
}

