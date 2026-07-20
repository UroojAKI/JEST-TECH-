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

@Injectable()
export class RenewPolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly policyDomainService: PolicyDomainService,
  ) {}

  async execute(id: string, dto: RenewPolicyDto, renewedById: string) {
    const existing = await this.policyRepository.findById(id);
    if (!existing || existing.deletedAt) {
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

    // 1. Update Policy Expiry and Status
    const updated = await this.policyRepository.update(id, {
      status: PolicyStatus.ACTIVE,
      expiryDate: newExpiryDate,
      updatedBy: { connect: { id: renewedById } },
    });

    // 2. Add PolicyRenewal Record
    await this.policyRepository.createRenewal({
      policy: { connect: { id: id } },
      renewalNumber: dto.renewalNumber,
      previousExpiry,
      newExpiry: newExpiryDate,
      premiumAmount: Money.from(dto.premiumAmount).value,
    });

    // 3. Log History Entry
    await this.policyRepository.addHistoryEntry(
      id,
      'RENEWAL',
      `Policy renewed successfully. Renewal Number: ${dto.renewalNumber}. New Expiry: ${newExpiryDate.toISOString()}`,
      renewedById,
    );

    const finalPolicy = await this.policyRepository.findDetail(id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
