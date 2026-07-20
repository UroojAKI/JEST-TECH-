import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';

@Injectable()
export class WorkflowWorker {
  private readonly logger = new Logger(WorkflowWorker.name);

  async process(job: Job): Promise<void> {
    this.logger.log(`Processing Workflow job ${job.id}`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
