import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

export interface SendMessageDto {
  channel: string;
  contactId: string;
  entityType?: string;
  entityId?: string;
  messagePreview: string;
  messageBody?: string;
  provider: string;
  providerMessageId: string;
  subject?: string;
  templateId?: string;
}

@Injectable()
export class CommunicationService {
  private readonly logger = new Logger(CommunicationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs an outbound communication attempt.
   * This represents the "Hybrid" storage strategy where we keep metadata + body in JEST.
   */
  async logOutboundMessage(dto: SendMessageDto) {
    const initialStatus = dto.providerMessageId ? 'PROVIDER_ACCEPTED' : 'QUEUED';
    const log = await this.prisma.communicationLog.create({
      data: {
        channel: dto.channel,
        direction: 'OUTBOUND',
        status: initialStatus,
        contactId: dto.contactId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        provider: dto.provider,
        providerMessageId: dto.providerMessageId,
        templateId: dto.templateId,
        subject: dto.subject,
        messagePreview: dto.messagePreview,
        messageBody: dto.messageBody, // We store the body for important business comms
        sentAt: null, // Will be set when provider confirms dispatch (SENT status)
      },
    });

    this.logger.log(
      `Logged outbound ${dto.channel} message for contact ${dto.contactId} with status ${initialStatus}`,
    );
    return log;
  }

  /**
   * Handles delivery callbacks from providers (e.g. Twilio/SendGrid webhooks).
   */
  async updateDeliveryStatus(
    providerMessageId: string,
    status: string,
    errorCode?: string,
  ) {
    // Map provider statuses to standard JEST statuses: QUEUED -> PROCESSING -> PROVIDER_ACCEPTED -> SENT -> DELIVERED
    const upper = status.toUpperCase();
    let mappedStatus = upper;
    if (['SENT', 'DELIVERED', 'READ', 'QUEUED', 'PROCESSING', 'PROVIDER_ACCEPTED'].includes(upper)) {
      mappedStatus = upper;
    } else if (['FAILED', 'UNDELIVERED', 'BOUNCED'].includes(upper)) {
      mappedStatus = 'FAILED';
    }

    const updateData: any = {
      status: mappedStatus,
    };

    if (mappedStatus === 'SENT') updateData.sentAt = new Date();
    if (mappedStatus === 'DELIVERED') updateData.deliveredAt = new Date();
    if (mappedStatus === 'READ') updateData.readAt = new Date();
    if (mappedStatus === 'FAILED') {
      updateData.failedAt = new Date();
      updateData.errorCode = errorCode;
    }

    const result = await this.prisma.communicationLog.updateMany({
      where: { providerMessageId },
      data: updateData,
    });

    return result.count > 0;
  }
}
