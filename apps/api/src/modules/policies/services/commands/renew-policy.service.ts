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
        include: { quotation: true },
      });
      if (!existing) throw new NotFoundException(`Policy with ID ${id} not found`);

      if (existing.status !== PolicyStatus.ACTIVE && existing.status !== PolicyStatus.PENDING_RENEWAL) {
        throw new BadRequestException(`Only ACTIVE or PENDING_RENEWAL policies can be renewed. Current status: ${existing.status}`);
      }

      if (dto.switchInsurer) {
        throw new BadRequestException(
          'Insurer switching cannot be represented by a history note. Create a new renewal quotation with the target insurer before completing renewal.',
        );
      }

      const previousExpiry = existing.expiryDate;
      const newExpiryDate = new Date(dto.newExpiry);
      if (Number.isNaN(newExpiryDate.getTime())) {
        throw new BadRequestException('newExpiry must be a valid date');
      }

      // Premium is an authoritative server value. The client cannot set the renewal premium.
      const authoritativePremium = new Prisma.Decimal(existing.premiumAmount);
      if (dto.premiumAmount !== undefined && Math.abs(Number(dto.premiumAmount) - Number(authoritativePremium)) > 0.01) {
        throw new BadRequestException(
          `Renewal premium mismatch. Client supplied ₹${dto.premiumAmount}, but the authoritative policy snapshot is ₹${authoritativePremium.toString()}. A renewal quotation must be created for any repricing.`,
        );
      }

      this.policyDomainService.validateRenewal(
        existing.status,
        previousExpiry,
        newExpiryDate,
        Number(authoritativePremium),
      );

      let nextNcb = 0;
      if (existing.quotation && typeof existing.quotation.ncbPercentage === 'number') {
        nextNcb = this.renewalEngineService.calculateNextNCBSlab(existing.quotation.ncbPercentage);
      }

      await tx.policy.update({
        where: { id },
        data: {
          status: PolicyStatus.ACTIVE,
          expiryDate: newExpiryDate,
          version: { increment: 1 },
          updatedBy: { connect: { id: renewedById } },
        },
      });

      await tx.policyRenewal.create({
        data: {
          policyId: id,
          renewalNumber: dto.renewalNumber,
          previousExpiry,
          newExpiry: newExpiryDate,
          premiumAmount: authoritativePremium,
        },
      });

      await tx.policyHistory.create({
        data: {
          policyId: id,
          status: 'RENEWAL',
          comments: `Policy renewed successfully. Renewal Number: ${dto.renewalNumber}. New Expiry: ${newExpiryDate.toISOString()} [AUTHORITATIVE_PREMIUM: ${authoritativePremium.toString()}] [NEXT_NCB: ${nextNcb}%]`,
          createdById: renewedById,
        },
      });

      const finalPolicy = await this.policyRepository.findDetail(id);
      return PolicyMapper.toResponse(finalPolicy!);
    });
  }
}
