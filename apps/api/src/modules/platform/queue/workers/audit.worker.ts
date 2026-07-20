import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class AuditWorker {
  private readonly logger = new Logger(AuditWorker.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing Audit job ${job.id}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
