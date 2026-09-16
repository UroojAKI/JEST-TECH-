import { Test, TestingModule } from '@nestjs/testing';
import { WebhookGatewayController } from './webhook-gateway.controller';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

import * as crypto from 'crypto';

describe('WebhookGatewayController', () => {
  let controller: WebhookGatewayController;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaService;
  const webhookSecret = 'test_webhook_secret_key_32_bytes!';

  beforeEach(async () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = webhookSecret;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookGatewayController],
      providers: [
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            webhookAuditLog: {
              findUnique: jest.fn(),
              create: jest.fn(),
            },
            auditLog: {
              create: jest.fn().mockResolvedValue({}),
            },
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookGatewayController>(WebhookGatewayController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should process a valid webhook and emit an event', async () => {
    const payload = { id: 'evt_123', event: 'payment.captured' };
    const rawPayload = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const headers = {
      'x-razorpay-event-id': 'evt_123',
      'x-razorpay-signature': validSignature,
      'x-razorpay-timestamp': Math.floor(Date.now() / 1000).toString(),
    };

    (prisma.webhookAuditLog.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await controller.handleWebhook(
      'razorpay',
      payload,
      headers,
      {},
    );

    expect(prisma.webhookAuditLog.findUnique).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_123' },
    });
    expect(prisma.webhookAuditLog.create).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'integration.webhook.razorpay.payment.captured',
      payload,
    );
    expect(result).toEqual({ status: 'success' });
  });

  it('should reject invalid webhook signatures with 401', async () => {
    const payload = { id: 'evt_bad', event: 'payment.captured' };
    const headers = {
      'x-razorpay-event-id': 'evt_bad',
      'x-razorpay-signature': 'invalid_signature_hex_digest_string_32',
      'x-razorpay-timestamp': Math.floor(Date.now() / 1000).toString(),
    };

    await expect(
      controller.handleWebhook('razorpay', payload, headers, {}),
    ).rejects.toThrow();
  });

  it('should ignore a duplicate webhook (idempotency)', async () => {
    const payload = { id: 'evt_123', event: 'payment.captured' };
    const rawPayload = JSON.stringify(payload);
    const validSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawPayload)
      .digest('hex');

    const headers = {
      'x-razorpay-event-id': 'evt_123',
      'x-razorpay-signature': validSignature,
      'x-razorpay-timestamp': Math.floor(Date.now() / 1000).toString(),
    };

    // Simulate existing log with same payload
    (prisma.webhookAuditLog.findUnique as jest.Mock).mockResolvedValue({
      id: 'log_1',
      providerEventId: 'evt_123',
      payload: rawPayload,
    });

    const result = await controller.handleWebhook(
      'razorpay',
      payload,
      headers,
      {},
    );

    expect(prisma.webhookAuditLog.findUnique).toHaveBeenCalledWith({
      where: { providerEventId: 'evt_123' },
    });
    expect(prisma.webhookAuditLog.create).not.toHaveBeenCalled(); // Should not create a new log
    expect(eventEmitter.emit).not.toHaveBeenCalled(); // Should not emit event
    expect(result).toEqual(
      expect.objectContaining({
        status: 'ignored',
        reason: 'already_processed',
      }),
    );
  });

  it('should throw BadRequestException if idempotency key is missing', async () => {
    const payload = {}; // Missing id
    const headers = {}; // Missing custom header

    await expect(
      controller.handleWebhook('unknown', payload, headers, {}),
    ).rejects.toThrow(BadRequestException);
  });
});
