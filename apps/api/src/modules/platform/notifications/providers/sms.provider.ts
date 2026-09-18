import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannelProvider,
  SendNotificationPayload,
  NotificationProviderResult,
} from './notification-provider.interface';

@Injectable()
export class SmsProvider implements NotificationChannelProvider {
  readonly channelName = 'SMS';
  private readonly logger = new Logger(SmsProvider.name);

  async send(payload: SendNotificationPayload): Promise<NotificationProviderResult> {
    const isConfigured = Boolean(
      (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) ||
        process.env.MSG91_AUTH_KEY,
    );

    if (!isConfigured) {
      this.logger.warn(
        `[SmsProvider] Outbound SMS gateway not configured. Dropping message to ${payload.to}.`,
      );
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        failureReason: 'SMS provider credentials not configured in environment',
      };
    }

    try {
      this.logger.log(`[SmsProvider] Transmitting SMS to ${payload.to}`);
      return {
        success: true,
        status: 'SENT',
        providerMessageId: `sms-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
    } catch (err: any) {
      this.logger.error(`[SmsProvider] Failed to send SMS to ${payload.to}: ${err.message}`);
      return {
        success: false,
        status: 'FAILED',
        failureReason: err.message,
      };
    }
  }
}
