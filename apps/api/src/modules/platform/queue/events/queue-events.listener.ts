import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../database/prisma.service';
import { JobStatus } from '@prisma/client';

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsListener.name);
  private queueEvents: QueueEvents;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.queueEvents = new QueueEvents('system-queue', {
      connection: { url: this.configService.get<string>('redis.url') },
    });

    this.queueEvents.on('active', async ({ jobId }) => {
      await this.updateJobStatus(jobId, JobStatus.RUNNING, { startedAt: new Date() });
    });

    this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      await this.updateJobStatus(jobId, JobStatus.COMPLETED, { completedAt: new Date() });
    });

    this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
      // Find current attempts from DB
      const job = await this.prisma.backgroundJob.findUnique({ where: { id: jobId } });
      if (!job) return;

      const attempts = job.attempts + 1;
      const status = attempts >= job.maxAttempts ? JobStatus.FAILED : JobStatus.RETRYING;

      await this.updateJobStatus(jobId, status, {
        attempts,
        error: failedReason,
        ...(status === JobStatus.FAILED ? { completedAt: new Date() } : {}),
      });
    });

    this.queueEvents.on('delayed', async ({ jobId, delay }) => {
      await this.updateJobStatus(jobId, JobStatus.DELAYED);
    });

    this.logger.log('Started listening to BullMQ events');
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      await this.queueEvents.close();
    }
  }

  private async updateJobStatus(jobId: string, status: JobStatus, additionalData: any = {}) {
    try {
      await this.prisma.backgroundJob.updateMany({
        where: { id: jobId },
        data: {
          status,
          ...additionalData,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to update background job ${jobId} status to ${status}: ${error.message}`);
    }
  }
}
