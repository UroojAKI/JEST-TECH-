import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigurationService } from '../platform/configuration/configuration.service';
import Redis from 'ioredis';
import * as os from 'os';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
  ) {}

  async checkReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      const redis = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();

      return true;
    } catch {
      return false;
    }
  }

  async checkDeep() {
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

    let redisStatus = 'disconnected';
    let redisLatencyMs = 0;
    try {
      const start = Date.now();
      const redis = new Redis(this.config.redisUrl, {
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redis.connect();
      await redis.ping();
      await redis.quit();
      redisLatencyMs = Date.now() - start;
      redisStatus = 'connected';
    } catch (err) {
      redisStatus = 'error';
    }

    const memory = process.memoryUsage();
    let activeUsers = 0;
    let activeJobs = 0;
    if (dbStatus === 'connected') {
      activeUsers = await this.prisma.user.count().catch(() => 0);
      activeJobs = await this.prisma.backgroundJob
        .count({ where: { status: { in: ['QUEUED', 'RUNNING'] } } })
        .catch(() => 0);
    }

    const isHealthy = dbStatus === 'connected' && redisStatus === 'connected';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
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
        redis: {
          status: redisStatus,
          latencyMs: redisLatencyMs,
        },
        queue: {
          activeJobs,
        },
      },
      metrics: {
        activeUsers,
      },
    };
  }
}
