import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import {
  QUEUE_PROVIDER_TOKEN,
  type QueueProvider,
} from '../interfaces/queue-provider.interface';
import { JobStatus } from '@prisma/client';

@Injectable()
export class QueueDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(QUEUE_PROVIDER_TOKEN) private readonly queueProvider: QueueProvider,
  ) {}

  async getJobs(skip: number = 0, take: number = 20, status?: JobStatus) {
    const where = status ? { status } : {};

    const [total, jobs] = await Promise.all([
      this.prisma.backgroundJob.count({ where }),
      this.prisma.backgroundJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
    ]);

    return {
      data: jobs,
      meta: {
        total,
        skip,
        take,
      },
    };
  }

  async getJobDetails(id: string) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Background job ${id} not found`);
    }

    return job;
  }

  async retryJob(id: string) {
    const job = await this.getJobDetails(id);
    if (!job.jobId) {
      throw new NotFoundException(`Job ${id} has no bullmq jobId`);
    }
    const result = await this.queueProvider.retry(job.jobId);
    return { success: result };
  }

  async deleteJob(id: string) {
    const job = await this.getJobDetails(id);
    if (job.jobId) {
      await this.queueProvider.remove(job.jobId);
    } else {
      await this.prisma.backgroundJob.delete({ where: { id } });
    }
    return { success: true };
  }

  async getStatistics() {
    const grouped = await this.prisma.backgroundJob.groupBy({
      by: ['status'],
      _count: true,
    });

    const stats = {
      QUEUED: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
      RETRYING: 0,
      DELAYED: 0,
    };

    grouped.forEach((g) => {
      stats[g.status] = g._count;
    });

    return stats;
  }
}
