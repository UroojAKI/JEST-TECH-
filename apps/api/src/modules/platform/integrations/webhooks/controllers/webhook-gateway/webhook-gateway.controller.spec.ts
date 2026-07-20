import { Test, TestingModule } from '@nestjs/testing';
import { WebhookGatewayController } from './webhook-gateway.controller';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('WebhookGatewayController', () => {
  let controller: WebhookGatewayController;
  let eventEmitter: EventEmitter2;
  let prisma: PrismaService;

  beforeEach(async () => {
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
          },
        },
      ],
    }).compile();

    controller = module.get<WebhookGatewayController>(WebhookGatewayController);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should process a valid webhook and emit an event', async () => {
    const payload = { id: 'evt_123', event: 'payment.captured' };
    const headers = { 'x-razorpay-event-id': 'evt_123', 'x-razorpay-signature': 'valid_sig' };

    (prisma.webhookAuditLog.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await controller.handleWebhook('razorpay', payload, headers, {});

    expect(prisma.webhookAuditLog.findUnique).toHaveBeenCalledWith({ where: { providerEventId: 'evt_123' } });
    expect(prisma.webhookAuditLog.create).toHaveBeenCalled();
    expect(eventEmitter.emit).toHaveBeenCalledWith('integration.webhook.razorpay.payment.captured', payload);
    expect(result).toEqual({ status: 'success' });
  });

  it('should ignore a duplicate webhook (idempotency)', async () => {
    const payload = { id: 'evt_123', event: 'payment.captured' };
    const headers = { 'x-razorpay-event-id': 'evt_123', 'x-razorpay-signature': 'valid_sig' };

    // Simulate existing log
    (prisma.webhookAuditLog.findUnique as jest.Mock).mockResolvedValue({ id: 'log_1', providerEventId: 'evt_123' });

    const result = await controller.handleWebhook('razorpay', payload, headers, {});

    expect(prisma.webhookAuditLog.findUnique).toHaveBeenCalledWith({ where: { providerEventId: 'evt_123' } });
    expect(prisma.webhookAuditLog.create).not.toHaveBeenCalled(); // Should not create a new log
    expect(eventEmitter.emit).not.toHaveBeenCalled(); // Should not emit event
    expect(result).toEqual({ status: 'ignored', reason: 'already_processed' });
  });

  it('should throw BadRequestException if idempotency key is missing', async () => {
    const payload = { }; // Missing id
    const headers = { }; // Missing custom header

    await expect(controller.handleWebhook('unknown', payload, headers, {}))
      .rejects.toThrow(BadRequestException);
  });
});
