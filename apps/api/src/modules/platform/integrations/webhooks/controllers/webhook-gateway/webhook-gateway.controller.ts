import { Controller, Post, Body, Param, Headers, Logger, Req, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../../../database/prisma.service';

@Controller('webhooks')
export class WebhookGatewayController {
  private readonly logger = new Logger(WebhookGatewayController.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly prisma: PrismaService,
  ) {}

  @Post(':provider')
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    this.logger.log(`Received webhook from provider: ${provider}`);

    // 1. Extract Provider Event ID for Idempotency
    const providerEventId = this.extractEventId(provider, payload, headers);
    
    if (!providerEventId) {
      throw new BadRequestException('Missing provider event ID for idempotency');
    }

    // 2. Check Idempotency
    const existingLog = await this.prisma.webhookAuditLog.findUnique({
      where: { providerEventId },
    });

    if (existingLog) {
      this.logger.warn(`Idempotency hit for ${providerEventId}. Ignoring duplicate webhook.`);
      return { status: 'ignored', reason: 'already_processed' };
    }

    // 3. Signature Validation (mocked logic for now)
    this.validateSignature(provider, payload, headers);

    // 4. Log Webhook for Idempotency
    await this.prisma.webhookAuditLog.create({
      data: {
        provider,
        providerEventId,
        eventType: this.extractEventType(provider, payload),
        payload: JSON.stringify(payload),
      },
    });

    // 5. Emit Event for Business Modules
    const eventName = `integration.webhook.${provider}.${this.extractEventType(provider, payload)}`;
    this.eventEmitter.emit(eventName, payload);

    return { status: 'success' };
  }

  private extractEventId(provider: string, payload: any, headers: any): string | null {
    switch (provider) {
      case 'razorpay': return headers['x-razorpay-event-id'] || payload.id;
      case 'twilio': return payload.MessageSid;
      default: return payload.id || headers['x-webhook-id'] || null;
    }
  }

  private extractEventType(provider: string, payload: any): string {
    switch (provider) {
      case 'razorpay': return payload.event; // e.g., 'payment.captured'
      case 'twilio': return payload.MessageStatus; // e.g., 'delivered'
      default: return payload.type || 'unknown';
    }
  }

  private validateSignature(provider: string, payload: any, headers: any) {
    // Implement actual HMAC validation per provider
    // Throw BadRequestException if invalid
    if (provider === 'razorpay' && !headers['x-razorpay-signature']) {
       throw new BadRequestException('Missing signature');
    }
  }
}
