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
    const log = await this.prisma.communicationLog.create({
      data: {
        channel: dto.channel,
        direction: 'OUTBOUND',
        status: 'SENT',
        contactId: dto.contactId,
        entityType: dto.entityType,
        entityId: dto.entityId,
        provider: dto.provider,
        providerMessageId: dto.providerMessageId,
        templateId: dto.templateId,
        subject: dto.subject,
        messagePreview: dto.messagePreview,
        messageBody: dto.messageBody, // We store the body for important business comms
        sentAt: new Date(),
      }
    });

    this.logger.log(`Logged outbound ${dto.channel} message for contact ${dto.contactId}`);
    return log;
  }

  /**
   * Handles delivery callbacks from providers (e.g. Twilio webhook).
   */
  async updateDeliveryStatus(providerMessageId: string, status: string, errorCode?: string) {
    // Map provider statuses to standard JEST statuses
    let mappedStatus = status;
    if (['DELIVERED', 'READ'].includes(status.toUpperCase())) {
      mappedStatus = status.toUpperCase();
    } else if (['FAILED', 'UNDELIVERED'].includes(status.toUpperCase())) {
      mappedStatus = 'FAILED';
    }

    const updateData: any = {
      status: mappedStatus,
    };

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
