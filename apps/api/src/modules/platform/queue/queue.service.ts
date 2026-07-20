import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger('QueueService');
  private readonly processors = new Map<string, (data: any) => Promise<void>>();

  constructor(@InjectQueue('system-queue') private readonly systemQueue: Queue) {}

  /**
   * Registers a callback worker to handle a specific job name.
   */
  registerProcessor(jobName: string, processor: (data: any) => Promise<void>) {
    this.processors.set(jobName, processor);
    this.logger.log(`Registered background job processor for: ${jobName}`);
  }

  /**
   * Returns the registered processor for a job name.
   */
  getProcessor(jobName: string): ((data: any) => Promise<void>) | undefined {
    return this.processors.get(jobName);
  }

  /**
   * Enqueues a job to be processed asynchronously in the background.
   */
  async addJob(queueName: string, jobName: string, data: any): Promise<void> {
    this.logger.log(`Enqueuing background job [${jobName}] to BullMQ`);
    await this.systemQueue.add(jobName, data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });
  }

  /**
   * Returns current active job count.
   */
  async getActiveJobCount(): Promise<number> {
    const counts = await this.systemQueue.getJobCounts();
    return counts.active;
  }
}
