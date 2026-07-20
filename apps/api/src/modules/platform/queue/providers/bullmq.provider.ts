import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';
import { QueueProvider, EnqueueOptions } from '../interfaces/queue-provider.interface';
import { JobType, JobStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BullMQProvider implements QueueProvider, OnApplicationShutdown {
  private readonly logger = new Logger(BullMQProvider.name);

  constructor(
    @InjectQueue('system-queue') private readonly systemQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  async onApplicationShutdown(signal?: string) {
    this.logger.log(`Received shutdown signal: ${signal}. Closing queue connection...`);
    await this.systemQueue.close();
  }

  async enqueue(type: JobType, payload: any, options?: EnqueueOptions): Promise<string> {
    const id = uuidv4();

    // 1. Save to DB first
    await this.prisma.backgroundJob.create({
      data: {
        id,
        queue: this.systemQueue.name,
        type,
        status: JobStatus.QUEUED,
        payload: payload ? payload : undefined,
        maxAttempts: options?.attempts || 3,
        correlationId: options?.correlationId,
        createdBy: options?.createdBy,
      },
    });

    // 2. Add to BullMQ
    const job = await this.systemQueue.add(type, payload, {
      jobId: id,
      attempts: options?.attempts || 3,
      delay: options?.delay,
      priority: options?.priority,
      backoff: options?.backoff,
      removeOnComplete: true, // we track in DB, no need to bloat Redis
      removeOnFail: false, // keep for manual retry / dead letter
    });

    // 3. Update job with Redis jobId just in case (should match)
    if (job.id && job.id !== id) {
       await this.prisma.backgroundJob.update({
         where: { id },
         data: { jobId: job.id.toString() }
       });
    } else {
       await this.prisma.backgroundJob.update({
         where: { id },
         data: { jobId: id }
       });
    }

    this.logger.debug(`Enqueued job ${id} of type ${type}`);
    return id;
  }

  async schedule(type: JobType, payload: any, date: Date, options?: EnqueueOptions): Promise<string> {
    const delay = date.getTime() - Date.now();
    return this.enqueue(type, payload, { ...options, delay: Math.max(0, delay) });
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await this.systemQueue.getJob(jobId);
    if (!job) {
      this.logger.warn(`Job ${jobId} not found in queue`);
      return false;
    }
    await job.remove();
    
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: JobStatus.CANCELLED },
    });
    
    return true;
  }

  async retry(jobId: string): Promise<boolean> {
    const job = await this.systemQueue.getJob(jobId);
    if (!job) return false;
    
    await job.retry();
    
    await this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: JobStatus.RETRYING },
    });
    
    return true;
  }

  async remove(jobId: string): Promise<boolean> {
    const job = await this.systemQueue.getJob(jobId);
    if (job) await job.remove();
    
    await this.prisma.backgroundJob.delete({
      where: { id: jobId },
    }).catch(() => null);
    
    return true;
  }
}
