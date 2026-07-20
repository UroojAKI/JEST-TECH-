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
    const { claim } = event;
    this.logger.log(`Claim ${claim.claimNumber} registered successfully. Database transaction completed.`);
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
