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
    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.MAIL_FROM;

    // SMTP_HOST and SES_REGION are not implemented transports in this provider.
    // Never report success merely because unrelated mail configuration exists.
    if (!apiKey || !fromEmail) {
      this.logger.warn('Outbound email not sent: configure SENDGRID_API_KEY and MAIL_FROM for the SendGrid transport.');
      return {
        success: false,
        status: 'NOT_CONFIGURED',
        failureReason: 'SendGrid transport requires SENDGRID_API_KEY and MAIL_FROM',
      };
    }

    if (!payload.to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.to)) {
      return {
        success: false,
        status: 'FAILED',
        failureReason: 'A valid recipient email address is required',
      };
    }

    try {
      const text = [
        payload.message,
        payload.actionUrl ? `\n\nContinue: ${payload.actionUrl}` : '',
      ].join('');

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: payload.to, ...(payload.recipientName ? { name: payload.recipientName } : {}) }],
          }],
          from: { email: fromEmail },
          subject: payload.title,
          content: [{ type: 'text/plain', value: text }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (response.status !== 202) {
        const providerError = await response.text().catch(() => '');
        this.logger.error(`SendGrid rejected outbound email (HTTP ${response.status}).`);
        return {
          success: false,
          status: 'FAILED',
          failureReason: `SendGrid rejected the message (HTTP ${response.status})${providerError ? ': ' + providerError.slice(0, 500) : ''}`,
        };
      }

      return {
        success: true,
        status: 'SENT',
        providerMessageId: response.headers.get('x-message-id') || undefined,
      };
    } catch (error: any) {
      this.logger.error(`Outbound email transport failed: ${error?.message || 'unknown error'}`);
      return {
        success: false,
        status: 'FAILED',
        failureReason: error?.name === 'TimeoutError' || error?.name === 'AbortError'
          ? 'Email provider request timed out'
          : 'Email provider request failed',
      };
    }
  }
}
