import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class RenewalWorker {
  private readonly logger = new Logger(RenewalWorker.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing Renewal job ${job.id}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
