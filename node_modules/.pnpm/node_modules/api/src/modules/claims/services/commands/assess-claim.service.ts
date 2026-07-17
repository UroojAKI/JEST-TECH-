import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimStatus, Prisma } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { AssessClaimDto } from '../../dto/assess-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class AssessClaimService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async execute(claimId: string, dto: AssessClaimDto, assessorId: string) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Validate state transition using ClaimStateMachine
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.UNDER_ASSESSMENT);

    // Create assessment record
    await this.claimRepository.addAssessment({
      claim: { connect: { id: claimId } },
      assessor: { connect: { id: assessorId } },
      findings: dto.findings,
      estimatedLoss: new Prisma.Decimal(dto.estimatedLoss),
      approvedAmount: new Prisma.Decimal(dto.approvedAmount),
      status: 'COMPLETED',
    });

    // Update claim status and approved amount
    await this.claimRepository.update(claimId, {
      status: ClaimStatus.UNDER_ASSESSMENT,
      approvedAmount: new Prisma.Decimal(dto.approvedAmount),
      updatedBy: { connect: { id: assessorId } },
    });

    // Record history
    await this.claimRepository.addHistoryEntry(
      claimId,
      ClaimStatus.UNDER_ASSESSMENT,
      'ASSESS_CLAIM',
      `Assessment completed. Findings: ${dto.findings}. Estimated Loss: ${dto.estimatedLoss}, Approved Amount: ${dto.approvedAmount}`,
      assessorId,
    );

    const finalClaim = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(finalClaim!);
  }
}
