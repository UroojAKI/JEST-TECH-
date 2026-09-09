import { Test, TestingModule } from '@nestjs/testing';
import { OutboxService } from './outbox.service';
import { PrismaService } from '../../../database/prisma.service';
import { OutboxStatus } from '@prisma/client';

describe('OutboxService', () => {
  let service: OutboxService;

  const mockPrisma = {
    outboxEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OutboxService>(OutboxService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should record an event using transaction client', async () => {
    const mockTx: any = {
      outboxEvent: {
        create: jest.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    const result = await service.recordEvent(mockTx, {
      aggregateType: 'POLICY',
      aggregateId: 'pol-123',
      eventType: 'POLICY_ISSUED',
      payload: { policyNumber: 'POL-001' },
    });

    expect(mockTx.outboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        aggregateType: 'POLICY',
        aggregateId: 'pol-123',
        eventType: 'POLICY_ISSUED',
        status: OutboxStatus.PENDING,
      }),
    });
    expect(result).toEqual({ id: 'evt-1' });
  });

  it('should fetch pending events with batch limit', async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([{ id: 'evt-1' }]);

    const result = await service.getPendingEvents(10);
    expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 }),
    );
    expect(result).toEqual([{ id: 'evt-1' }]);
  });

  it('should mark an event as DELIVERED (published)', async () => {
    mockPrisma.outboxEvent.update.mockResolvedValue({
      id: 'evt-1',
      status: OutboxStatus.DELIVERED,
    });

    const result = await service.markPublished('evt-1');
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        status: OutboxStatus.DELIVERED,
        processedAt: expect.any(Date),
      },
    });
    expect(result.status).toBe(OutboxStatus.DELIVERED);
  });

  it('should mark an event as DEAD_LETTER (failed) after max retries', async () => {
    // Simulate event that has reached maxAttempts
    mockPrisma.outboxEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'evt-1',
      attempts: 5,
      maxAttempts: 5,
    });
    mockPrisma.outboxEvent.update.mockResolvedValue({
      id: 'evt-1',
      status: OutboxStatus.DEAD_LETTER,
    });

    const result = await service.markFailed('evt-1', 'Timeout error');
    expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'evt-1' },
        data: expect.objectContaining({
          status: OutboxStatus.DEAD_LETTER,
          lastError: 'Timeout error',
        }),
      }),
    );
    expect(result.status).toBe(OutboxStatus.DEAD_LETTER);
  });
});

