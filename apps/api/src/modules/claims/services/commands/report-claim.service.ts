import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  ClaimStatus,
  CommunicationChannel,
  PolicyStatus,
  Prisma,
} from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { PolicyRepository } from '../../../policies/repositories/policy.repository';
import { ReportClaimDto } from '../../dto/report-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../platform/cache/redis-cache.service';
import { Inject } from '@nestjs/common';

@Injectable()
export class ReportClaimService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly policyRepository: PolicyRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
  ) {}

  async execute(dto: ReportClaimDto, createdById: string) {
    // 1. Validate Policy exists
    const policy = await this.policyRepository.findById(dto.policyId);
    if (!policy || policy.deletedAt) {
      throw new NotFoundException(`Policy with ID ${dto.policyId} not found`);
    }

    // 2. Policy Status Gate: Only ACTIVE or PENDING_RENEWAL policies can have claims registered
    if (
      policy.status !== PolicyStatus.ACTIVE &&
      policy.status !== PolicyStatus.PENDING_RENEWAL
    ) {
      throw new BadRequestException(
        `Claims cannot be filed against policy ${policy.policyNumber} with status ${policy.status}`,
      );
    }

    // 3. Coverage Period Invariant: incidentDate must fall strictly between effectiveDate and expiryDate
    const incidentDate = new Date(dto.incidentDate);
    if (incidentDate < policy.effectiveDate || incidentDate > policy.expiryDate) {
      throw new BadRequestException(
        `Claim incident date ${dto.incidentDate} falls outside policy coverage dates (${policy.effectiveDate.toISOString()} to ${policy.expiryDate.toISOString()})`,
      );
    }

    // 4. Duplicate Active Claim Invariant
    const existingClaim = await this.prisma.claim.findFirst({
      where: {
        policyId: dto.policyId,
        incidentDate,
        status: { not: ClaimStatus.CLOSED },
        deletedAt: null,
      },
    });

    if (existingClaim) {
      throw new BadRequestException(
        `A claim has already been registered for policy ${policy.policyNumber} on the incident date ${dto.incidentDate}`,
      );
    }

    // 5. Generate Claim Number
    const claimNumber = await this.claimRepository.generateClaimNumber();

    // 6. Map create payload
    const claimData: Prisma.ClaimCreateInput = {
      claimNumber,
      status: ClaimStatus.REPORTED,
      policy: { connect: { id: dto.policyId } },
      contact: { connect: { id: policy.contactId } },
      incidentDate,
      description: dto.description,
      claimAmount: new Prisma.Decimal(dto.claimAmount),
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (policy.accountId) {
      claimData.account = { connect: { id: policy.accountId } };
    }

    // 7. Save to database in a single atomic transaction
    const claim = await this.prisma.$transaction(async (tx) => {
      // 7.1 Create the Claim
      const createdClaim = await this.claimRepository.create(claimData, tx);

      // 7.2 Add history entry for registration
      await this.claimRepository.addHistoryEntry(
        createdClaim.id,
        ClaimStatus.REGISTERED,
        'REGISTER_CLAIM',
        `Claim ${claimNumber} reported and registered. Incident date: ${incidentDate.toISOString()}`,
        createdById,
        tx,
      );

      // 7.3 Update Status to REGISTERED
      const updatedClaim = await this.claimRepository.update(
        createdClaim.id,
        {
          status: ClaimStatus.REGISTERED,
        },
        tx,
      );

      // 7.4 Log Customer Communication
      const contact = await tx.contact.findUnique({
        where: { id: policy.contactId },
      });
      const recipientEmail = contact?.email || 'customer@example.com';

      await this.claimRepository.addCommunication(
        {
          claim: { connect: { id: createdClaim.id } },
          recipient: recipientEmail,
          channel: CommunicationChannel.EMAIL,
          subject: `Claim Registered - ${claimNumber}`,
          body: `Hello, your claim ${claimNumber} for policy ${policy.policyNumber} has been successfully registered. We are reviewing the details and will assign an assessor shortly.`,
        },
        tx,
      );

      return updatedClaim;
    });

    // 8. Emit Event after transaction commits
    await this.eventEmitter.emitAsync('claim.registered', {
      claim,
      createdById,
    });

    return ClaimMapper.toResponse(claim);
  }
}
