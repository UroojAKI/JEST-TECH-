import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationDispatcher } from '../services/notification-dispatcher.service';
import { NotificationPriority, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly dispatcher: NotificationDispatcher) {}

  @OnEvent('claim.registered')
  async handleClaimRegistered(event: { claim: any; createdById: string }) {
    this.logger.log(
      `Handling claim.registered event for claim ID: ${event.claim.id}`,
    );
    const agentId = event.claim.createdById || event.createdById;
    if (!agentId) return;

    await this.dispatcher.dispatch({
      userId: agentId,
      type: NotificationType.CLAIM_REGISTERED,
      priority: NotificationPriority.HIGH,
      title: 'New Claim Registered',
      message: `Claim ${event.claim.claimNumber} has been successfully registered for Policy ID: ${event.claim.policyId}.`,
      entityId: event.claim.id,
      entityType: 'CLAIM',
      actionUrl: `/dashboard?claimId=${event.claim.id}`,
    });
  }

  @OnEvent('claim.approved')
  async handleClaimApproved(event: {
    claim: any;
    updatedById: string;
    comments?: string;
  }) {
    this.logger.log(
      `Handling claim.approved event for claim ID: ${event.claim.id}`,
    );
    const agentId = event.claim.createdById || event.updatedById;
    if (!agentId) return;

    await this.dispatcher.dispatch({
      userId: agentId,
      type: NotificationType.CLAIM_APPROVED,
      priority: NotificationPriority.HIGH,
      title: 'Claim Approved',
      message: `Claim ${event.claim.claimNumber} has been approved. Approved Amount: ₹${event.claim.approvedAmount}. Comments: ${event.comments || 'None'}.`,
      entityId: event.claim.id,
      entityType: 'CLAIM',
      actionUrl: `/dashboard?claimId=${event.claim.id}`,
    });
  }

  @OnEvent('claim.rejected')
  async handleClaimRejected(event: {
    claim: any;
    updatedById: string;
    comments?: string;
  }) {
    this.logger.log(
      `Handling claim.rejected event for claim ID: ${event.claim.id}`,
    );
    const agentId = event.claim.createdById || event.updatedById;
    if (!agentId) return;

    await this.dispatcher.dispatch({
      userId: agentId,
      type: NotificationType.CLAIM_SETTLED,
      priority: NotificationPriority.CRITICAL,
      title: 'Claim Rejected',
      message: `Claim ${event.claim.claimNumber} has been rejected. Comments: ${event.comments || 'None'}.`,
      entityId: event.claim.id,
      entityType: 'CLAIM',
      actionUrl: `/dashboard?claimId=${event.claim.id}`,
    });
  }

  @OnEvent('lead.converted')
  async handleLeadConverted(event: any) {
    const lead = event.lead || event;
    const agentId = lead.createdById || lead.assignedToId;
    if (!agentId) return;

    await this.dispatcher.dispatch({
      userId: agentId,
      type: NotificationType.LEAD_UPDATED,
      priority: NotificationPriority.MEDIUM,
      title: 'Lead Converted to Policy',
      message: `Lead ${lead.leadCode} has been successfully converted into a Policy.`,
      entityId: lead.id,
      entityType: 'LEAD',
      actionUrl: `/dashboard?leadId=${lead.id}`,
    });
  }
}
