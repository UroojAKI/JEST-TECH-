import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { OutboxStatus, Prisma } from '@prisma/client';

export interface CreateOutboxEventParams {
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
}

@Injectable()
export class OutboxService {
  private readonly logger = new Logger(OutboxService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Record an event atomically within an existing Prisma transaction client.
   */
  async recordEvent(
    tx: Prisma.TransactionClient,
    params: CreateOutboxEventParams,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: params.aggregateType,
        aggregateId: params.aggregateId,
        eventType: params.eventType,
        payload: params.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
      },
    });
  }

  async getPendingEvents(batchSize = 50) {
    return this.prisma.outboxEvent.findMany({
      where: { status: OutboxStatus.PENDING },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
    });
  }

  async markProcessing(eventId: string) {
    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });
  }

  async markPublished(eventId: string) {
    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.PUBLISHED,
        processedAt: new Date(),
      },
    });
  }

  async markFailed(eventId: string, errorMessage: string) {
    return this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: OutboxStatus.FAILED,
        lastError: errorMessage,
      },
    });
  }
}
