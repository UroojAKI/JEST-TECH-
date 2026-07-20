import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaimStatus, ReserveType, CommunicationChannel, Prisma } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { PolicyRepository } from '../../../policies/repositories/policy.repository';
import { ReportClaimDto } from '../../dto/report-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class ReportClaimService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly policyRepository: PolicyRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
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

    // 4. Save to database in a single transaction
    const claim = await this.prisma.$transaction(async (tx) => {
      // 4.1 Create the Claim
      const createdClaim = await this.claimRepository.create(claimData, tx);

      // 4.2 Create Initial Claim Reserve
      await this.claimRepository.addReserve({
        claim: { connect: { id: createdClaim.id } },
        amount: createdClaim.claimAmount,
        type: ReserveType.INITIAL,
        comments: 'Initial reserve set to claim amount on registration.',
        createdBy: { connect: { id: createdById } },
      }, tx);

      // 4.3 Add history entry for registration
      await this.claimRepository.addHistoryEntry(
        createdClaim.id,
        ClaimStatus.REGISTERED,
        'REGISTER_CLAIM',
        `Claim registered and initial reserve of ${createdClaim.claimAmount} set.`,
        createdById,
        tx,
      );

      // 4.4 Update Status to REGISTERED
      const updatedClaim = await this.claimRepository.update(createdClaim.id, {
        status: ClaimStatus.REGISTERED,
      }, tx);

      // 4.5 Log Communication stub
      await this.claimRepository.addCommunication({
        claim: { connect: { id: createdClaim.id } },
        recipient: 'customer@example.com',
        channel: CommunicationChannel.EMAIL,
        subject: `Claim Registered - ${claimNumber}`,
        body: `Hello, your claim ${claimNumber} has been successfully registered. We are reviewing the details and will assign an assessor shortly.`,
      }, tx);

      return updatedClaim;
    });

    // 5. Emit Event after transaction commits
    await this.eventEmitter.emitAsync('claim.registered', { claim, createdById });

    return ClaimMapper.toResponse(claim);
  }
}
