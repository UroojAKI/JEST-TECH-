import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';
import { HealthService } from './health.service';

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
  async check() {
    const health = await this.health.checkDeep();
    if (health.status !== 'healthy') {
      throw new ServiceUnavailableException(health);
    }
    return health;
  }

  @Get('terminus')
  @HealthCheck()
  checkTerminus() {
    return this.healthCheck.check([
      () => this.db.pingCheck('database', this.prisma),
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'C:\\' : '/',
          thresholdPercent: 0.9,
        }),
      () => this.memory.checkHeap('memory_heap', 512 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024),
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
