import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QueueService } from './queue.service';

@Processor('system-queue')
export class SystemQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(SystemQueueProcessor.name);

  constructor(private readonly queueService: QueueService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job [${job.name}] with id: ${job.id}`);
    
    const processor = this.queueService.getProcessor(job.name);
    
    if (!processor) {
      this.logger.error(`No processor registered for job: ${job.name}`);
      throw new Error(`Processor for ${job.name} not found`);
    }

    await processor(job.data);
    this.logger.log(`Successfully completed job [${job.name}] with id: ${job.id}`);
  }
}
