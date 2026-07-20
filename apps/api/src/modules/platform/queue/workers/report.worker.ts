import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class ReportWorker {
  private readonly logger = new Logger(ReportWorker.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing Report job ${job.id}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
