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

      const redisEnabled = process.env.REDIS_ENABLED === 'true';
      if (redisEnabled && this.config.redisUrl) {
        const redis = new Redis(this.config.redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
        redis.on('error', () => {});
        await redis.connect();
        await redis.ping();
        await redis.quit();
      }

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
    } catch {
      dbStatus = 'error';
    }

    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    let redisStatus = redisEnabled ? 'disconnected' : 'disabled';
    let redisLatencyMs = 0;
    if (redisEnabled && this.config.redisUrl) {
      try {
        const start = Date.now();
        const redis = new Redis(this.config.redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
        redis.on('error', () => {});
        await redis.connect();
        await redis.ping();
        await redis.quit();
        redisLatencyMs = Date.now() - start;
        redisStatus = 'connected';
      } catch {
        redisStatus = 'error';
      }
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

    const isHealthy =
      dbStatus === 'connected' &&
      (!redisEnabled || redisStatus === 'connected');

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
    } catch {
      dbStatus = 'down';
    }

    let redisStatus = 'disabled';
    let redisLatencyMs = 0;
    const redisEnabled = process.env.REDIS_ENABLED === 'true';
    if (redisEnabled && this.config.redisUrl) {
      try {
        const start = Date.now();
        const redis = new Redis(this.config.redisUrl, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
        redis.on('error', () => {});
        await redis.connect();
        await redis.ping();
        await redis.quit();
        redisLatencyMs = Date.now() - start;
        redisStatus = 'ok';
      } catch {
        redisStatus = 'down';
      }
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapLimitMB = parseInt(process.env.MAX_HEAP_MB || '1024', 10);
    const memoryStatus = heapUsedMB > heapLimitMB * 0.9 ? 'degraded' : 'ok';

    let diskStatus = 'ok';
    let freeDiskGB = 0;
    let totalDiskGB = 0;
    try {
      const checkPath = process.platform === 'win32' ? process.cwd() : '/';
      if (typeof fs.statfsSync === 'function') {
        const stats = fs.statfsSync(checkPath);
        freeDiskGB = Math.round((stats.bavail * stats.bsize) / (1024 * 1024 * 1024));
        totalDiskGB = Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
        if (freeDiskGB < 1 || (totalDiskGB > 0 && freeDiskGB / totalDiskGB < 0.05)) {
          diskStatus = 'degraded';
        }
      } else {
        fs.statSync(checkPath);
      }
    } catch {
      diskStatus = 'down';
    }

    let outboxStatus = 'ok';
    let pendingOutboxEvents = 0;
    let failedOutboxEvents = 0;
    let oldestPendingAgeSeconds = 0;
    try {
      const [pending, failed, oldest] = await Promise.all([
        this.prisma.outboxEvent.count({ where: { status: 'PENDING' } }),
        this.prisma.outboxEvent.count({ where: { status: 'FAILED' } }),
        this.prisma.outboxEvent.findFirst({
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'asc' },
          select: { createdAt: true },
        }),
      ]);
      pendingOutboxEvents = pending;
      failedOutboxEvents = failed;
      if (oldest) {
        oldestPendingAgeSeconds = Math.round(
          (Date.now() - new Date(oldest.createdAt).getTime()) / 1000,
        );
      }
      if (failedOutboxEvents > 10 || oldestPendingAgeSeconds > 3600) {
        outboxStatus = 'degraded';
      }
    } catch {
      outboxStatus = 'down';
    }

    const checks = {
      database: { status: dbStatus, latencyMs: dbLatencyMs },
      redis: { status: redisStatus, latencyMs: redisLatencyMs },
      outbox: {
        status: outboxStatus,
        pendingEvents: pendingOutboxEvents,
        failedEvents: failedOutboxEvents,
        oldestAgeSeconds: oldestPendingAgeSeconds,
      },
      memory: {
        status: memoryStatus,
        heapUsedMB,
        heapLimitMB,
      },
      disk: {
        status: diskStatus,
        freeDiskGB: freeDiskGB > 0 ? freeDiskGB : undefined,
        totalDiskGB: totalDiskGB > 0 ? totalDiskGB : undefined,
      },
    };

    let overallStatus = 'ok';
    if (dbStatus === 'down') {
      overallStatus = 'down';
    } else if (
      (redisEnabled && redisStatus === 'down') ||
      outboxStatus === 'down' ||
      diskStatus === 'down' ||
      memoryStatus === 'degraded' ||
      outboxStatus === 'degraded' ||
      diskStatus === 'degraded'
    ) {
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
