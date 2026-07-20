import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueueService } from '../platform/queue/queue.service';
import * as os from 'os';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  async database() {
    let dbStatus = 'disconnected';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'connected';
    } catch (err) {
      dbStatus = 'error';
    }

    const memory = process.memoryUsage();
    const activeUsers = await this.prisma.user.count().catch(() => 0);

    return {
      status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      system: {
        platform: process.platform,
        cpuCores: os.cpus().length,
        freeMemoryBytes: os.freemem(),
        totalMemoryBytes: os.totalmem(),
      },
      process: {
        memoryUsage: {
          rss: memory.rss,
          heapTotal: memory.heapTotal,
          heapUsed: memory.heapUsed,
          external: memory.external,
        },
      },
      services: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
        },
        queue: {
          activeJobs: this.queueService.getActiveJobCount(),
        },
      },
      metrics: {
        activeUsers,
      },
    };
  }
}
