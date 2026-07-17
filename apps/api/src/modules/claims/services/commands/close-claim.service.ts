import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimStatus } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class CloseClaimService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async execute(claimId: string, comments: string, updatedById: string) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Validate state transition using ClaimStateMachine
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.CLOSED);

    // Update claim status
    await this.claimRepository.update(claimId, {
      status: ClaimStatus.CLOSED,
      updatedBy: { connect: { id: updatedById } },
    });

    // Record history entry
    await this.claimRepository.addHistoryEntry(
      claimId,
      ClaimStatus.CLOSED,
      'CLOSE_CLAIM',
      comments || 'Claim closed successfully.',
      updatedById,
    );

    const finalClaim = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(finalClaim!);
  }
}
