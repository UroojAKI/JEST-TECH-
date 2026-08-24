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
import { RenewalEngineService } from '../renewal-engine.service';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class RenewPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
    private readonly renewalEngineService: RenewalEngineService,
  ) {}

  async execute(id: string, dto: RenewPolicyDto, renewedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.policy.findFirst({
        where: { id, deletedAt: null },
        include: { quotation: true }
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

      let nextNcb = 0;
      let ncbAppliedStr = '';
      if (existing.quotation && typeof existing.quotation.ncbPercentage === 'number') {
         nextNcb = this.renewalEngineService.calculateNextNCBSlab(existing.quotation.ncbPercentage);
         ncbAppliedStr = ` [NCB_APPLIED: ${nextNcb}%]`;
      }
      
      let insurerSwitchStr = dto.switchInsurer ? ' [INSURER_SWITCH]' : '';

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
          comments: `Policy renewed successfully. Renewal Number: ${dto.renewalNumber}. New Expiry: ${newExpiryDate.toISOString()}${ncbAppliedStr}${insurerSwitchStr}`,
          createdById: renewedById,
        },
      });

      const finalPolicy = await this.policyRepository.findDetail(id);
      return PolicyMapper.toResponse(finalPolicy!);
    });
  }
}
