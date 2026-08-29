import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { QueueEvents } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../database/prisma.service';
import { JobStatus } from '@prisma/client';

@Injectable()
export class QueueEventsListener implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsListener.name);
  private queueEvents?: QueueEvents;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    if (process.env.REDIS_ENABLED !== 'true') {
      this.logger.warn(
        'Redis disabled or offline (REDIS_ENABLED != true). Bypassing BullMQ QueueEvents initialization.',
      );
      return;
    }

    const redisUrl =
      this.configService.get<string>('REDIS_URL') ||
      this.configService.get<string>('redis.url') ||
      process.env.REDIS_URL ||
      'redis://localhost:6380';

    try {
      this.queueEvents = new QueueEvents('system-queue', {
        connection: {
          url: redisUrl,
          maxRetriesPerRequest: null,
          retryStrategy: (times: number) =>
            times > 3 ? null : Math.min(times * 500, 3000),
        },
      });

      this.queueEvents.on('error', (err) => {
        this.logger.warn(`BullMQ Redis Connection Warning: ${err.message}`);
      });

      this.queueEvents.on('active', async ({ jobId }) => {
        await this.updateJobStatus(jobId, JobStatus.RUNNING, {
          startedAt: new Date(),
        });
      });

      this.queueEvents.on('completed', async ({ jobId, returnvalue }) => {
        await this.updateJobStatus(jobId, JobStatus.COMPLETED, {
          completedAt: new Date(),
        });
      });

      this.queueEvents.on('failed', async ({ jobId, failedReason }) => {
        const job = await this.prisma.backgroundJob.findUnique({
          where: { id: jobId },
        });
        if (!job) return;

        const attempts = job.attempts + 1;
        const status =
          attempts >= job.maxAttempts ? JobStatus.FAILED : JobStatus.RETRYING;

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
    } catch (err: any) {
      this.logger.warn(`Could not initialize QueueEvents: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.queueEvents) {
      try {
        await this.queueEvents.close();
      } catch (err) {
        // Ignore close errors
      }
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: JobStatus,
    additionalData: any = {},
  ) {
    try {
      await this.prisma.backgroundJob.updateMany({
        where: { id: jobId },
        data: {
          status,
          ...additionalData,
        },
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to update background job ${jobId} status to ${status}: ${error.message}`,
      );
    }
  }
}
