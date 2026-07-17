import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ClaimStatus } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class ApproveClaimService {
  constructor(
    private readonly claimRepository: ClaimRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(claimId: string, approve: boolean, comments: string, updatedById: string) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    const targetStatus = approve ? ClaimStatus.APPROVED : ClaimStatus.REJECTED;

    // Validate state transition
    ClaimStateMachine.validateTransition(claim.status, targetStatus);

    // Update claim
    const updated = await this.claimRepository.update(claimId, {
      status: targetStatus,
      updatedBy: { connect: { id: updatedById } },
    });

    // Record history
    await this.claimRepository.addHistoryEntry(
      claimId,
      targetStatus,
      approve ? 'APPROVE_CLAIM' : 'REJECT_CLAIM',
      comments || (approve ? 'Claim approved by claims officer.' : 'Claim rejected by claims officer.'),
      updatedById,
    );

    // Emit Event
    if (approve) {
      this.eventEmitter.emit('claim.approved', { claim: updated, updatedById, comments });
    } else {
      this.eventEmitter.emit('claim.rejected', { claim: updated, updatedById, comments });
    }

    const finalClaim = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(finalClaim!);
  }
}
