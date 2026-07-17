import { Injectable, NotFoundException } from '@nestjs/common';
import { ClaimStatus, PaymentStatus, Prisma } from '@prisma/client';
import { ClaimRepository } from '../../repositories/claim.repository';
import { ClaimStateMachine } from '../../domain/claim-state-machine';
import { PayClaimDto } from '../../dto/pay-claim.dto';
import { ClaimMapper } from '../../mappers/claim.mapper';

@Injectable()
export class PayClaimService {
  constructor(private readonly claimRepository: ClaimRepository) {}

  async execute(claimId: string, dto: PayClaimDto, updatedById: string) {
    const claim = await this.claimRepository.findById(claimId);
    if (!claim || claim.deletedAt) {
      throw new NotFoundException(`Claim with ID ${claimId} not found`);
    }

    // Validate state transition using ClaimStateMachine
    ClaimStateMachine.validateTransition(claim.status, ClaimStatus.SETTLED);

    // Create payment record
    await this.claimRepository.addPayment({
      claim: { connect: { id: claimId } },
      amount: new Prisma.Decimal(dto.amount),
      transactionId: dto.transactionId,
      paymentMethod: dto.paymentMethod,
      status: PaymentStatus.SUCCESS,
      recipientDetails: dto.recipientDetails,
    });

    // Update claim status
    await this.claimRepository.update(claimId, {
      status: ClaimStatus.SETTLED,
      updatedBy: { connect: { id: updatedById } },
    });

    // Record history entry
    await this.claimRepository.addHistoryEntry(
      claimId,
      ClaimStatus.SETTLED,
      'PAY_CLAIM',
      `Payment of ${dto.amount} successfully processed. Txn ID: ${dto.transactionId}`,
      updatedById,
    );

    const finalClaim = await this.claimRepository.findById(claimId);
    return ClaimMapper.toResponse(finalClaim!);
  }
}
