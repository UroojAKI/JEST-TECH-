import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OutboxService } from './outbox.service';

@Injectable()
export class OutboxProcessor {
  private readonly logger = new Logger(OutboxProcessor.name);
  private isRunning = false;

  constructor(
    private readonly outboxService: OutboxService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Cron('*/10 * * * * *')
  async processOutbox() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const events = await this.outboxService.getPendingEvents(25);
      if (!events || events.length === 0) {
        return;
      }

      this.logger.log(`Processing ${events.length} outbox events...`);

      for (const event of events) {
        try {
          await this.outboxService.markProcessing(event.id);
          this.eventEmitter.emit(event.eventType, event.payload);
          await this.outboxService.markPublished(event.id);
        } catch (dispatchErr: any) {
          this.logger.error(
            `Failed to publish outbox event ${event.id}: ${dispatchErr.message}`,
            dispatchErr.stack,
          );
          await this.outboxService.markFailed(event.id, dispatchErr.message);
        }
      }
    } catch (err: any) {
      this.logger.error(`Outbox polling error: ${err.message}`, err.stack);
    } finally {
      this.isRunning = false;
    }
  }
}
