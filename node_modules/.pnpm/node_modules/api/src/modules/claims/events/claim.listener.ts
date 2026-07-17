import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClaimStatus, ReserveType, CommunicationChannel } from '@prisma/client';
import { ClaimRepository } from '../repositories/claim.repository';

@Injectable()
export class ClaimListener {
  private readonly logger = new Logger(ClaimListener.name);

  constructor(private readonly claimRepository: ClaimRepository) {}

  @OnEvent('claim.registered')
  async handleClaimRegistered(event: { claim: any; createdById: string }) {
    const { claim, createdById } = event;
    this.logger.log(`Processing claim.registered event for claim number: ${claim.claimNumber}`);

    try {
      // 1. Create Initial Claim Reserve
      await this.claimRepository.addReserve({
        claim: { connect: { id: claim.id } },
        amount: claim.claimAmount,
        type: ReserveType.INITIAL,
        comments: 'Initial reserve set to claim amount on registration.',
        createdBy: { connect: { id: createdById } },
      });

      // 2. Add history entry for registration
      await this.claimRepository.addHistoryEntry(
        claim.id,
        ClaimStatus.REGISTERED,
        'REGISTER_CLAIM',
        `Claim registered and initial reserve of ${claim.claimAmount} set.`,
        createdById,
      );

      // 3. Update Status to REGISTERED
      await this.claimRepository.update(claim.id, {
        status: ClaimStatus.REGISTERED,
      });

      // 4. Log Communication stub (e.g. mock email notification)
      await this.claimRepository.addCommunication({
        claim: { connect: { id: claim.id } },
        recipient: 'customer@example.com',
        channel: CommunicationChannel.EMAIL,
        subject: `Claim Registered - ${claim.claimNumber}`,
        body: `Hello, your claim ${claim.claimNumber} has been successfully registered. We are reviewing the details and will assign an assessor shortly.`,
      });

      this.logger.log(`Successfully completed registration handler for claim ${claim.claimNumber}`);
    } catch (error: any) {
      this.logger.error(`Failed to execute registration logic for claim ${claim.claimNumber}: ${error.message}`);
    }
  }

  @OnEvent('claim.approved')
  async handleClaimApproved(event: { claim: any; updatedById: string; comments: string }) {
    const { claim, updatedById, comments } = event;
    this.logger.log(`Processing claim.approved event for claim number: ${claim.claimNumber}`);

    try {
      // 1. Create ADJUSTED/RELEASED Claim Reserve
      await this.claimRepository.addReserve({
        claim: { connect: { id: claim.id } },
        amount: claim.approvedAmount,
        type: ReserveType.RELEASED,
        comments: `Reserve released based on approved amount. Comments: ${comments}`,
        createdBy: { connect: { id: updatedById } },
      });

      // 2. Log Communication stub
      await this.claimRepository.addCommunication({
        claim: { connect: { id: claim.id } },
        recipient: 'customer@example.com',
        channel: CommunicationChannel.EMAIL,
        subject: `Claim Approved - ${claim.claimNumber}`,
        body: `Hello, we are pleased to inform you that your claim ${claim.claimNumber} has been approved for payment of ${claim.approvedAmount}. Comments: ${comments}`,
      });

      this.logger.log(`Successfully completed approval handler for claim ${claim.claimNumber}`);
    } catch (error: any) {
      this.logger.error(`Failed to execute approval logic for claim ${claim.claimNumber}: ${error.message}`);
    }
  }
}
