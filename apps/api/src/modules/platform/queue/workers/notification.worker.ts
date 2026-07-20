import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing Notification job ${job.id} with payload: ${JSON.stringify(job.data)}`,
    );
    // Placeholder for actual notification logic (SMS, Email, WhatsApp)
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
