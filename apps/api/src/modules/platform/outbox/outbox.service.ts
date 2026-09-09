import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Prisma, OutboxStatus } from '@prisma/client';

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
   * Use this inside $transaction blocks to ensure the outbox entry is written
   * in the same database transaction as the business state change.
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
        attempts: 0,
        maxAttempts: 5,
      },
    });
  }

  /**
   * Publish an outbox event outside a transaction (for non-transactional contexts).
   */
  async publish(event: {
    aggregateId: string;
    aggregateType: string;
    eventType: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        aggregateId: event.aggregateId,
        aggregateType: event.aggregateType,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        status: OutboxStatus.PENDING,
        attempts: 0,
        maxAttempts: 5,
      },
    });
  }

  /**
   * Fetch up to `limit` PENDING events that are due for processing.
   * Respects exponential backoff via nextRetryAt.
   */
  async getPendingEvents(limit = 25) {
    return this.prisma.outboxEvent.findMany({
      where: {
        status: OutboxStatus.PENDING,
        attempts: { lt: 5 },
        OR: [
          { nextRetryAt: null },
          { nextRetryAt: { lte: new Date() } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /** Mark an event as PROCESSING (claim it from the queue). */
  async markProcessing(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxStatus.PROCESSING,
        attempts: { increment: 1 },
      },
    });
  }

  /** Mark an event as DELIVERED (successfully dispatched). */
  async markPublished(id: string) {
    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: OutboxStatus.DELIVERED,
        processedAt: new Date(),
      },
    });
  }

  /**
   * Mark an event as FAILED and schedule retry or dead-letter it.
   * Implements exponential backoff: 2^attempts * 30s, capped at 300s.
   */
  async markFailed(id: string, error: string) {
    const event = await this.prisma.outboxEvent.findUniqueOrThrow({ where: { id } });
    const isDead = event.attempts >= event.maxAttempts;
    const backoffSeconds = Math.min(300, Math.pow(2, event.attempts) * 30);
    const nextRetry = new Date(Date.now() + backoffSeconds * 1000);

    return this.prisma.outboxEvent.update({
      where: { id },
      data: {
        status: isDead ? OutboxStatus.DEAD_LETTER : OutboxStatus.PENDING,
        lastError: error,
        nextRetryAt: isDead ? null : nextRetry,
        deadLetteredAt: isDead ? new Date() : null,
      },
    });
  }
}
