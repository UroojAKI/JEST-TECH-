import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ClaimStatus, CommunicationChannel } from '@prisma/client';
import { ClaimRepository } from '../repositories/claim.repository';

@Injectable()
export class ClaimListener {
  private readonly logger = new Logger(ClaimListener.name);

  constructor(private readonly claimRepository: ClaimRepository) {}

  @OnEvent('claim.registered')
  async handleClaimRegistered(event: { claim: any; createdById: string }) {
    const { claim } = event;
    this.logger.log(
      `Claim ${claim.claimNumber} registered successfully. Database transaction completed.`,
    );
  }

  @OnEvent('claim.approved')
  async handleClaimApproved(event: {
    claim: any;
    updatedById: string;
    comments: string;
  }) {
    const { claim, updatedById, comments } = event;
    this.logger.log(
      `Processing claim.approved event for claim number: ${claim.claimNumber}`,
    );

    try {
      // 1. Record approval history entry
      await this.claimRepository.addHistoryEntry(
        claim.id,
        ClaimStatus.APPROVED,
        'INSURER_DECISION_APPROVED',
        `Claim approved for amount ${claim.approvedAmount}. Comments: ${comments}`,
        updatedById,
      );

      // 2. Fetch authoritative contact details to avoid fake dummy recipients
      const fullClaim = await this.claimRepository.findById(claim.id);
      const contact = fullClaim?.contact || claim.contact;
      const recipientEmail = contact?.email;
      const recipientPhone = contact?.phone;

      if (recipientEmail) {
        await this.claimRepository.addCommunication({
          claim: { connect: { id: claim.id } },
          recipient: recipientEmail,
          channel: CommunicationChannel.EMAIL,
          subject: `Claim Approved - ${claim.claimNumber}`,
          body: `Hello, we are pleased to inform you that your claim ${claim.claimNumber} has been approved for payment of ₹${claim.approvedAmount}. Comments: ${comments}`,
        });
      } else if (recipientPhone) {
        await this.claimRepository.addCommunication({
          claim: { connect: { id: claim.id } },
          recipient: recipientPhone,
          channel: CommunicationChannel.SMS,
          subject: `Claim Approved - ${claim.claimNumber}`,
          body: `Your claim ${claim.claimNumber} has been approved for payment of ₹${claim.approvedAmount}.`,
        });
      } else {
        this.logger.warn(
          `No contact email or phone available for claim ${claim.claimNumber}; skipping communication dispatch without fabricating dummy recipient.`,
        );
      }

      this.logger.log(
        `Successfully completed approval handler for claim ${claim.claimNumber}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to execute approval logic for claim ${claim.claimNumber}: ${error.message}`,
      );
    }
  }
}
