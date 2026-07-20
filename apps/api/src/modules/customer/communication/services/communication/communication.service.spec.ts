import { Test, TestingModule } from '@nestjs/testing';
import { CommunicationService } from './communication.service';
import { PrismaService } from '../../../../../database/prisma.service';

describe('CommunicationService', () => {
  let service: CommunicationService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommunicationService,
        {
          provide: PrismaService,
          useValue: {
            communicationLog: {
              create: jest.fn(),
              updateMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CommunicationService>(CommunicationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('logOutboundMessage', () => {
    it('should create a log entry with OUTBOUND direction and SENT status', async () => {
      jest.spyOn(prisma.communicationLog, 'create').mockResolvedValue({ id: 'log-1' } as any);

      const result = await service.logOutboundMessage({
        channel: 'WHATSAPP',
        contactId: 'contact-1',
        provider: 'KARIX',
        providerMessageId: 'msg-123',
        messagePreview: 'Hello...',
        messageBody: 'Hello World',
      });

      expect(result.id).toBe('log-1');
      expect(prisma.communicationLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'OUTBOUND',
            status: 'SENT',
            channel: 'WHATSAPP',
            providerMessageId: 'msg-123',
          })
        })
      );
    });
  });

  describe('updateDeliveryStatus', () => {
    it('should map provider DELIVERED to JEST DELIVERED and set deliveredAt', async () => {
      jest.spyOn(prisma.communicationLog, 'updateMany').mockResolvedValue({ count: 1 } as any);

      const result = await service.updateDeliveryStatus('msg-123', 'Delivered');

      expect(result).toBe(true);
      expect(prisma.communicationLog.updateMany).toHaveBeenCalledWith({
        where: { providerMessageId: 'msg-123' },
        data: expect.objectContaining({
          status: 'DELIVERED',
          deliveredAt: expect.any(Date),
        })
      });
    });

    it('should map provider UNDELIVERED to JEST FAILED and set failedAt', async () => {
      jest.spyOn(prisma.communicationLog, 'updateMany').mockResolvedValue({ count: 1 } as any);

      await service.updateDeliveryStatus('msg-123', 'Undelivered', 'ERR_500');

      expect(prisma.communicationLog.updateMany).toHaveBeenCalledWith({
        where: { providerMessageId: 'msg-123' },
        data: expect.objectContaining({
          status: 'FAILED',
          failedAt: expect.any(Date),
          errorCode: 'ERR_500',
        })
      });
    });
  });
});
