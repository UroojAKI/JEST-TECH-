import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigurationService } from '../platform/configuration/configuration.service';
import Redis from 'ioredis';
import * as os from 'os';
import * as fs from 'fs';
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
  async checkV2() {
    let dbStatus = 'down';
    let dbLatencyMs = 0;
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - start;
      dbStatus = 'ok';
    } catch (err) {
      dbStatus = 'down';
    }

    let redisStatus = 'down';
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
      redisStatus = 'ok';
    } catch (err) {
      redisStatus = 'down';
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapLimitMB = 512;
    const memoryStatus = heapUsedMB > heapLimitMB ? 'degraded' : 'ok';

    let diskStatus = 'ok';
    try {
      fs.statSync(process.platform === 'win32' ? process.cwd() : '/');
    } catch (err) {
      diskStatus = 'down';
    }

    let outboxStatus = 'ok';
    let pendingOutboxEvents = 0;
    try {
      pendingOutboxEvents = await this.prisma.outboxEvent.count({
        where: { status: 'PENDING' },
      });
    } catch {
      outboxStatus = 'down';
    }

    const checks = {
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
      outbox: { status: outboxStatus, pendingEvents: pendingOutboxEvents },
      memory: { status: memoryStatus, heapUsedMB, heapLimitMB },
      disk: { status: diskStatus },
    };

    let overallStatus = 'ok';
    const checkStatuses = Object.values(checks).map((c) => c.status);
    if (checkStatuses.includes('down')) {
      overallStatus = 'down';
    } else if (checkStatuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    };
  }
}
