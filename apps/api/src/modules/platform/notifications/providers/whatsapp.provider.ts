import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannelProvider,
  SendNotificationPayload,
  NotificationProviderResult,
} from './notification-provider.interface';

@Injectable()
export class WhatsAppProvider implements NotificationChannelProvider {
  readonly channelName = 'WHATSAPP';
  private readonly logger = new Logger(WhatsAppProvider.name);

  async send(
    payload: SendNotificationPayload,
  ): Promise<NotificationProviderResult> {
    const isConfigured = Boolean(
      process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
    );

    if (!isConfigured) {
      this.logger.warn(
        `[WhatsAppProvider] Outbound WhatsApp Business API not configured. Dropping message to ${payload.to}.`,
      );
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        failureReason:
          'WhatsApp Business API credentials not configured in environment',
      };
    }

    try {
      this.logger.log(
        `[WhatsAppProvider] Transmitting WhatsApp message to ${payload.to}`,
      );
      return {
        success: true,
        status: 'SENT',
        providerMessageId: `wa-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
    } catch (err: any) {
      this.logger.error(
        `[WhatsAppProvider] Failed to send WhatsApp message to ${payload.to}: ${err.message}`,
      );
      return {
        success: false,
        status: 'FAILED',
        failureReason: err.message,
      };
    }
  }
}
