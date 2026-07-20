const fs = require('fs');

const webhookContent = import { Controller, Post, Body, Param, Headers, Logger, Req, BadRequestException } from '@nestjs/common';
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
    this.logger.log(\Received webhook from provider: \\);

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
      this.logger.warn(\Idempotency hit for \. Ignoring duplicate webhook.\);
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
    const eventName = \integration.webhook.\.\\;
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
;
fs.writeFileSync('apps/api/src/modules/platform/integrations/webhooks/controllers/webhook-gateway/webhook-gateway.controller.ts', webhookContent);

const integrationHttpContent = import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { catchError, lastValueFrom, retry } from 'rxjs';
import * as CircuitBreaker from 'opossum';

@Injectable()
export class IntegrationHttpClient {
  private readonly logger = new Logger(IntegrationHttpClient.name);
  private breakers: Map<string, CircuitBreaker> = new Map();

  constructor(private readonly httpService: HttpService) {}

  /**
   * Performs an HTTP GET request wrapped in a Circuit Breaker with retries.
   */
  async get<T>(url: string, config?: AxiosRequestConfig, providerName: string = 'default'): Promise<T> {
    return this.executeWithBreaker(providerName, () => {
      const request = this.httpService.get<T>(url, config).pipe(
        retry(3), // Exponential retry can be added here or via axios-retry
        catchError((error) => {
          this.logger.error(\HTTP GET \ failed\, error?.message);
          throw error;
        }),
      );
      return lastValueFrom(request).then(response => response.data);
    });
  }

  /**
   * Performs an HTTP POST request wrapped in a Circuit Breaker with retries.
   */
  async post<T>(url: string, data?: any, config?: AxiosRequestConfig, providerName: string = 'default'): Promise<T> {
    return this.executeWithBreaker(providerName, () => {
      const request = this.httpService.post<T>(url, data, config).pipe(
        retry(3),
        catchError((error) => {
          this.logger.error(\HTTP POST \ failed\, error?.message);
          throw error;
        }),
      );
      return lastValueFrom(request).then(response => response.data);
    });
  }

  private async executeWithBreaker<T>(providerName: string, action: () => Promise<T>): Promise<T> {
    let breaker = this.breakers.get(providerName);

    if (!breaker) {
      breaker = new CircuitBreaker(action, {
        timeout: 10000, // 10 seconds request timeout
        errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
        resetTimeout: 30000, // Try again after 30 seconds
        name: providerName,
      });

      breaker.on('open', () => this.logger.warn(\Circuit Breaker OPEN for provider: \\));
      breaker.on('halfOpen', () => this.logger.log(\Circuit Breaker HALF-OPEN for provider: \\));
      breaker.on('close', () => this.logger.log(\Circuit Breaker CLOSED for provider: \\));
      breaker.on('fallback', () => this.logger.warn(\Fallback triggered for provider: \\));

      this.breakers.set(providerName, breaker);
    }

    return breaker.fire() as Promise<T>;
  }
}
;
fs.writeFileSync('apps/api/src/modules/platform/integrations/core/services/integration-http/integration-http.service.ts', integrationHttpContent);

const providerRegistryContent = import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../../../../database/prisma.service';
import { IntegrationProvider } from '@prisma/client';

@Injectable()
export class ProviderRegistryService implements OnModuleInit {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private cache: Map<string, IntegrationProvider[]> = new Map();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refreshCache();
  }

  async refreshCache() {
    const providers = await this.prisma.integrationProvider.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { priority: 'asc' },
    });

    this.cache.clear();
    for (const provider of providers) {
      if (!this.cache.has(provider.type)) {
        this.cache.set(provider.type, []);
      }
      this.cache.get(provider.type)?.push(provider);
    }
    this.logger.log(\Provider registry cache refreshed. Found \ active providers.\);
  }

  getPrimaryProvider(type: string): IntegrationProvider | null {
    const providers = this.cache.get(type);
    if (!providers || providers.length === 0) {
      this.logger.warn(\No active providers found for type: \\);
      return null;
    }
    // Assume sorted by priority (1 is highest)
    return providers[0];
  }

  getFallbackProvider(type: string, failedProviderId: string): IntegrationProvider | null {
    const providers = this.cache.get(type);
    if (!providers) return null;

    const fallback = providers.find(p => p.id !== failedProviderId);
    return fallback || null;
  }

  async recordFailure(providerId: string) {
    await this.prisma.integrationProvider.update({
      where: { id: providerId },
      data: { failureCount: { increment: 1 } },
    });
  }

  async recordSuccess(providerId: string) {
    // Basic moving average simulation or just tick success
    // A robust impl would store metrics in a time series
  }
}
;
fs.writeFileSync('apps/api/src/modules/platform/integrations/core/services/provider-registry/provider-registry.service.ts', providerRegistryContent);
