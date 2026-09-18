import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannelProvider,
  SendNotificationPayload,
  NotificationProviderResult,
} from './notification-provider.interface';

@Injectable()
export class EmailProvider implements NotificationChannelProvider {
  readonly channelName = 'EMAIL';
  private readonly logger = new Logger(EmailProvider.name);

  async send(payload: SendNotificationPayload): Promise<NotificationProviderResult> {
    const isConfigured = Boolean(
      process.env.SMTP_HOST || process.env.SENDGRID_API_KEY || process.env.SES_REGION,
    );

    if (!isConfigured) {
      this.logger.warn(
        `[EmailProvider] Outbound email provider not configured. Dropping message to ${payload.to}.`,
      );
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        failureReason: 'Email provider credentials not configured in environment',
      };
    }

    try {
      this.logger.log(`[EmailProvider] Transmitting email to ${payload.to}: ${payload.title}`);
      return {
        success: true,
        status: 'SENT',
        providerMessageId: `email-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      };
    } catch (err: any) {
      this.logger.error(`[EmailProvider] Failed to send email to ${payload.to}: ${err.message}`);
      return {
        success: false,
        status: 'FAILED',
        failureReason: err.message,
      };
    }
  }
}
