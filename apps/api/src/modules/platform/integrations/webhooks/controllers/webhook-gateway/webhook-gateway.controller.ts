import {
  Controller,
  Post,
  Body,
  Param,
  Headers,
  Logger,
  Req,
  BadRequestException,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../../../database/prisma.service';
import { AuditAction } from '@prisma/client';
import { Public } from '../../../../../auth/decorators/public.decorator';
import * as crypto from 'crypto';

@Public()
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
      throw new BadRequestException(
        'Missing provider event ID for idempotency',
      );
    }

    // 2. Validate Cryptographic Webhook Signature
    await this.validateSignature(provider, payload, headers, providerEventId);

    // Timestamp replay protection for Razorpay
    if (provider === 'razorpay') {
      const razorpayTimestamp = headers['x-razorpay-timestamp'];
      if (razorpayTimestamp) {
        const webhookTime = parseInt(razorpayTimestamp, 10) * 1000; // convert seconds to ms
        const now = Date.now();
        const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes
        if (Math.abs(now - webhookTime) > MAX_AGE_MS) {
          this.logger.warn(
            `[SECURITY] Webhook replay detected: timestamp too old or in future. provider=${provider}, age=${Math.abs(now - webhookTime)}ms`
          );
          throw new UnauthorizedException('Webhook timestamp out of acceptable range (replay protection)');
        }
      }
    }

    // 3. Compute incoming payload SHA-256 hash for strict 3-case semantics
    const payloadString =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const currentHash = crypto
      .createHash('sha256')
      .update(payloadString)
      .digest('hex');

    // 4. Check Idempotency (3-case webhook semantics per specification v4.2)
    const existingLog = await this.prisma.webhookAuditLog.findUnique({
      where: { providerEventId },
    });

    if (existingLog) {
      const existingPayloadString =
        typeof existingLog.payload === 'string'
          ? existingLog.payload
          : JSON.stringify(existingLog.payload || {});
      const existingHash = crypto
        .createHash('sha256')
        .update(existingPayloadString)
        .digest('hex');

      if (!existingLog.payload || existingHash === currentHash) {
        // Case B: Exact duplicate -> idempotent 200 no-op
        this.logger.log(
          `[Webhook] Case B: Exact duplicate received for ${providerEventId}. Idempotent 200 returned.`,
        );
        return {
          status: 'ignored',
          reason: 'already_processed',
          idempotent: true,
        };
      } else {
        // Case C: Same event ID but different payload -> 409 Conflict + Security Alert
        this.logger.error(
          `[Webhook] Case C: PAYMENT_TRANSACTION_CONFLICT for ${providerEventId}. Hash mismatch!`,
        );
        try {
          await this.prisma.auditLog.create({
            data: {
              action: AuditAction.REJECT,
              entity: 'WEBHOOK',
              entityId: providerEventId,
              module: 'INTEGRATIONS',
              performedById: 'SYSTEM_WEBHOOK_GATEWAY',
              oldValue: { hash: existingHash },
              newValue: { hash: currentHash, provider },
            },
          });
        } catch {
          // Log failure should not mask conflict error
        }
        throw new ConflictException(
          `PAYMENT_TRANSACTION_CONFLICT: Webhook event ID ${providerEventId} re-used with conflicting payload.`,
        );
      }
    }

    // Case A: New webhook -> record log, emit event for business reconciliation
    await this.prisma.webhookAuditLog.create({
      data: {
        provider,
        providerEventId,
        eventType: this.extractEventType(provider, payload),
        payload: payloadString,
      },
    });

    // 5. Emit Event for Business Modules
    const eventName = `integration.webhook.${provider}.${this.extractEventType(provider, payload)}`;
    this.eventEmitter.emit(eventName, payload);

    return { status: 'success' };
  }

  private extractEventId(
    provider: string,
    payload: any,
    headers: any,
  ): string | null {
    switch (provider) {
      case 'razorpay':
        return headers['x-razorpay-event-id'] || payload.id;
      case 'twilio':
        return payload.MessageSid;
      default:
        return payload.id || headers['x-webhook-id'] || null;
    }
  }

  private extractEventType(provider: string, payload: any): string {
    switch (provider) {
      case 'razorpay':
        return payload.event; // e.g., 'payment.captured'
      case 'twilio':
        return payload.MessageStatus; // e.g., 'delivered'
      default:
        return payload.type || 'unknown';
    }
  }

  private async validateSignature(
    provider: string,
    payload: any,
    headers: any,
    providerEventId: string | null,
  ): Promise<void> {
    const signature =
      headers['x-razorpay-signature'] ||
      headers['x-twilio-signature'] ||
      headers['x-webhook-signature'];

    if (provider === 'razorpay') {
      const razorpaySecret = process.env.RAZORPAY_WEBHOOK_SECRET;
      if (!razorpaySecret) {
        this.logger.error('[SECURITY] RAZORPAY_WEBHOOK_SECRET is not configured. Rejecting webhook.');
        throw new UnauthorizedException('Webhook provider not configured');
      }
      
      if (!signature) {
        throw new UnauthorizedException('Missing x-razorpay-signature header');
      }

      const rawPayload =
        typeof payload === 'string' ? payload : JSON.stringify(payload || {});
      const expectedSignature = crypto
        .createHmac('sha256', razorpaySecret)
        .update(rawPayload)
        .digest('hex');

      // Secure constant-time string comparison
      if (
        signature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(
          Buffer.from(signature),
          Buffer.from(expectedSignature),
        )
      ) {
        this.logger.error(
          `[SECURITY] Invalid webhook signature from provider=${provider}. Rejecting.`
        );
        // Log security event to audit log
        try {
          await this.prisma.auditLog.create({
            data: {
              action: AuditAction.REJECT,
              entity: 'WEBHOOK_SIGNATURE',
              entityId: providerEventId || 'UNKNOWN',
              module: 'SECURITY',
              performedById: 'SYSTEM_WEBHOOK_GATEWAY',
              newValue: { provider, reason: 'INVALID_SIGNATURE' },
            },
          });
        } catch { /* non-fatal */ }
        throw new UnauthorizedException('Invalid webhook signature');
      }
    }
  }
}
