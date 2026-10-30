import {
  Controller,
  Get,
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Response } from 'express';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';
import { HealthService } from './health.service';
import { Public } from '../auth/decorators/public.decorator';
import { SkipThrottle } from '@nestjs/throttler';

@Public()
@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthService,
    private readonly healthCheck: HealthCheckService,
    private readonly db: PrismaHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    const health = await this.health.checkV2();
    if (health.status === 'ok') {
      res.status(200);
    } else if (health.status === 'degraded') {
      res.status(200);
    } else {
      res.status(503);
    }
    return health;
  }

  @Get('terminus')
  @HealthCheck()
  checkTerminus() {
    const rootPath =
      process.platform === 'win32'
        ? `${process.cwd().split(/[/\\]/)[0]}\\`
        : '/';
    const heapLimitBytes =
      parseInt(process.env.MAX_HEAP_MB || '1024', 10) * 1024 * 1024;
    const rssLimitBytes =
      parseInt(process.env.MAX_RSS_MB || '1536', 10) * 1024 * 1024;

    return this.healthCheck.check([
      () => this.db.pingCheck('database', this.prisma),
      () =>
        this.disk.checkStorage('disk', {
          path: rootPath,
          thresholdPercent: 0.9,
        }),
      () => this.memory.checkHeap('memory_heap', heapLimitBytes),
      () => this.memory.checkRSS('memory_rss', rssLimitBytes),
    ]);
  }

  @Get('live')
  async live() {
    return {
      status: 'alive',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  async ready() {
    const isReady = await this.health.checkReady();
    if (!isReady) {
      throw new ServiceUnavailableException({ status: 'not_ready' });
    }
    return { status: 'ready', timestamp: new Date().toISOString() };
  }
}
