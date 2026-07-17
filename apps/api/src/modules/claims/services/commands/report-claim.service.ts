import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaimStatus, Prisma } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { PolicyRepository } from '../../../policies/repositories/policy.repository';
import { ReportClaimDto } from '../../dto/report-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class ReportClaimService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly policyRepository: PolicyRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(dto: ReportClaimDto, createdById: string) {
    // 1. Validate Policy exists
    const policy = await this.policyRepository.findById(dto.policyId);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${dto.policyId} not found`);
    }

    // 2. Generate Claim Number
    const claimNumber = await this.claimRepository.generateClaimNumber();

    // 3. Map create payload
    const claimData: Prisma.ClaimCreateInput = {
      claimNumber,
      status: ClaimStatus.REPORTED,
      policy: { connect: { id: dto.policyId } },
      contact: { connect: { id: policy.contactId } },
      incidentDate: new Date(dto.incidentDate),
      description: dto.description,
      claimAmount: new Prisma.Decimal(dto.claimAmount),
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (policy.accountId) {
      claimData.account = { connect: { id: policy.accountId } };
    }

    // 4. Save to database
    const claim = await this.claimRepository.create(claimData);

    // 5. Emit Event
    this.eventEmitter.emit('claim.registered', { claim, createdById });

    return ClaimMapper.toResponse(claim);
  }
}
