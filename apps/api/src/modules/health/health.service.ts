import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ConfigurationService } from '../platform/configuration/configuration.service';
import Redis from 'ioredis';
import * as os from 'os';
import * as fs from 'fs';

export type RedisConfigState = 'DISABLED' | 'CONFIGURED' | 'CONFIG_ERROR';

export interface RedisHealthState {
  policyEnabled: boolean;
  urlConfigured: boolean;
  state: RedisConfigState;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigurationService,
  ) {}

  getRedisConfigurationState(): RedisHealthState {
    const policyEnabled = process.env.REDIS_ENABLED === 'true';
    const redisUrl = this.config.redisUrl || process.env.REDIS_URL;
    const urlConfigured = !!redisUrl;

    if (!policyEnabled) {
      return { policyEnabled: false, urlConfigured, state: 'DISABLED' };
    }
    if (!urlConfigured) {
      return { policyEnabled: true, urlConfigured: false, state: 'CONFIG_ERROR' };
    }
    return { policyEnabled: true, urlConfigured: true, state: 'CONFIGURED' };
  }

  async checkReady(): Promise<{ ready: boolean; reason?: string; details: any }> {
    const details: any = {};

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      details.database = { status: 'ok' };
    } catch (err: any) {
      details.database = { status: 'down', error: err?.message || 'Database unreachable' };
      return { ready: false, reason: 'Database is unreachable', details };
    }

    const redisConfig = this.getRedisConfigurationState();
    if (redisConfig.state === 'CONFIG_ERROR') {
      details.redis = {
        status: 'config_error',
        message: 'Redis is enabled by policy (REDIS_ENABLED=true) but REDIS_URL is not configured',
      };
      return {
        ready: false,
        reason: 'Redis configuration error: REDIS_ENABLED=true but REDIS_URL is missing',
        details,
      };
    }

    if (redisConfig.state === 'CONFIGURED') {
      const redisUrl = this.config.redisUrl || process.env.REDIS_URL;
      try {
        const redis = new Redis(redisUrl!, {
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        });
        redis.on('error', () => {});
        await redis.connect();
        await redis.ping();
        await redis.quit();
        details.redis = { status: 'ok' };
      } catch (err: any) {
        details.redis = { status: 'down', error: err?.message || 'Connection failed' };
        return {
          ready: false,
          reason: 'Redis is enabled and configured but unreachable',
          details,
        };
      }
    } else {
      details.redis = { status: 'disabled' };
    }

    return { ready: true, details };
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

    const redisConfig = this.getRedisConfigurationState();
    let redisStatus = 'disabled';
    let redisLatencyMs = 0;
    let redisMessage: string | undefined = undefined;

    if (redisConfig.state === 'CONFIG_ERROR') {
      redisStatus = 'config_error';
      redisMessage = 'Redis is enabled by policy but REDIS_URL is not configured';
    } else if (redisConfig.state === 'CONFIGURED') {
      const redisUrl = this.config.redisUrl || process.env.REDIS_URL;
      try {
        const start = Date.now();
        const redis = new Redis(redisUrl!, {
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
      } catch (err: any) {
        redisStatus = 'down';
        redisMessage = err?.message || 'Redis connection failed';
      }
    } else {
      redisStatus = 'disabled';
      redisMessage = 'Redis is disabled by policy';
    }

    const memoryUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapLimitMB = parseInt(process.env.MAX_HEAP_MB || '1024', 10);
    const memoryStatus = heapUsedMB > heapLimitMB * 0.9 ? 'degraded' : 'ok';

    let diskStatus = 'ok';
    let freeDiskGB: number | undefined = undefined;
    let totalDiskGB: number | undefined = undefined;
    let diskMessage: string | undefined = undefined;
    try {
      const checkPath = process.platform === 'win32' ? process.cwd() : '/';
      if (typeof (fs as any).statfsSync === 'function') {
        const stats = (fs as any).statfsSync(checkPath);
        if (!stats) {
          diskStatus = 'unsupported';
          diskMessage = 'statfsSync unsupported in this runtime platform';
        } else {
          freeDiskGB = Math.round((stats.bavail * stats.bsize) / (1024 * 1024 * 1024));
          totalDiskGB = Math.round((stats.blocks * stats.bsize) / (1024 * 1024 * 1024));
          if (freeDiskGB < 1 || (totalDiskGB > 0 && freeDiskGB / totalDiskGB < 0.05)) {
            diskStatus = 'degraded';
          }
        }
      } else {
        fs.statSync(checkPath);
        diskStatus = 'unsupported';
        diskMessage = 'statfsSync unsupported in this runtime platform';
      }
    } catch (err: any) {
      if (err?.code === 'ENOSYS' || err?.message?.includes('ENOSYS') || err?.message?.includes('unsupported')) {
        diskStatus = 'unsupported';
        diskMessage = 'statfsSync unsupported in this runtime platform';
      } else {
        diskStatus = 'down';
        diskMessage = err?.message;
      }
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
      redis: {
        status: redisStatus,
        latencyMs: redisLatencyMs,
        configurationState: redisConfig.state,
        message: redisMessage,
      },
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
        freeDiskGB,
        totalDiskGB,
        message: diskMessage,
      },
    };

    let overallStatus = 'ok';
    if (dbStatus === 'down' || redisStatus === 'config_error') {
      overallStatus = 'down';
    } else if (
      (redisConfig.policyEnabled && redisStatus === 'down') ||
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

  async checkDeep() {
    return this.checkV2();
  }
}
