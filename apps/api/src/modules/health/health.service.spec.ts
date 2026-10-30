import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';
import { PrismaService } from '../../database/prisma.service';
import { ConfigurationService } from '../platform/configuration/configuration.service';
import Redis from 'ioredis';
import * as fs from 'fs';

jest.mock('ioredis');
jest.mock('fs', () => {
  const actualFs = jest.requireActual('fs');
  return {
    ...actualFs,
    statfsSync: jest.fn((...args: any[]) => {
      if (typeof actualFs.statfsSync === 'function') {
        return actualFs.statfsSync(...args);
      }
      return undefined;
    }),
  };
});

describe('HealthService Operational Semantics (Phase 11)', () => {
  let service: HealthService;
  let mockPrisma: any;
  let mockConfig: any;
  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv };
    delete process.env.REDIS_ENABLED;
    delete process.env.REDIS_URL;

    mockPrisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      outboxEvent: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    mockConfig = {
      redisUrl: undefined,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigurationService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('11.1 Redis configuration consistency', () => {
    it('evaluates Redis as DISABLED when REDIS_ENABLED is not set or false', () => {
      process.env.REDIS_ENABLED = 'false';
      const state = service.getRedisConfigurationState();
      expect(state.policyEnabled).toBe(false);
      expect(state.state).toBe('DISABLED');
    });

    it('evaluates Redis as CONFIG_ERROR when REDIS_ENABLED=true but REDIS_URL is absent', () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = undefined;
      const state = service.getRedisConfigurationState();
      expect(state.policyEnabled).toBe(true);
      expect(state.urlConfigured).toBe(false);
      expect(state.state).toBe('CONFIG_ERROR');
    });

    it('evaluates Redis as CONFIGURED when REDIS_ENABLED=true and REDIS_URL is provided', () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = 'redis://localhost:6379';
      const state = service.getRedisConfigurationState();
      expect(state.policyEnabled).toBe(true);
      expect(state.urlConfigured).toBe(true);
      expect(state.state).toBe('CONFIGURED');
    });
  });

  describe('11.2 Deep health versus readiness semantics', () => {
    it('fails readiness if database is unreachable (DB down -> readiness 503)', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
      const result = await service.checkReady();
      expect(result.ready).toBe(false);
      expect(result.reason).toBe('Database is unreachable');
      expect(result.details.database.status).toBe('down');
    });

    it('passes readiness when DB is up and Redis is disabled by policy', async () => {
      process.env.REDIS_ENABLED = 'false';
      const result = await service.checkReady();
      expect(result.ready).toBe(true);
      expect(result.details.database.status).toBe('ok');
      expect(result.details.redis.status).toBe('disabled');
    });

    it('fails readiness when Redis is enabled by policy but URL is missing (CONFIG_ERROR)', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = undefined;

      const result = await service.checkReady();
      expect(result.ready).toBe(false);
      expect(result.reason).toContain('Redis configuration error');
      expect(result.details.redis.status).toBe('config_error');
    });

    it('fails readiness when Redis is enabled and configured but connection fails (DOWN)', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = 'redis://localhost:6379';

      (Redis as unknown as jest.Mock).mockImplementationOnce(() => ({
        on: jest.fn(),
        connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:6379')),
        ping: jest.fn(),
        quit: jest.fn(),
      }));

      const result = await service.checkReady();
      expect(result.ready).toBe(false);
      expect(result.reason).toContain('Redis is enabled and configured but unreachable');
      expect(result.details.redis.status).toBe('down');
    });

    it('passes readiness when DB and Redis are both reachable', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = 'redis://localhost:6379';

      (Redis as unknown as jest.Mock).mockImplementationOnce(() => ({
        on: jest.fn(),
        connect: jest.fn().mockResolvedValue(undefined),
        ping: jest.fn().mockResolvedValue('PONG'),
        quit: jest.fn().mockResolvedValue('OK'),
      }));

      const result = await service.checkReady();
      expect(result.ready).toBe(true);
      expect(result.details.database.status).toBe('ok');
      expect(result.details.redis.status).toBe('ok');
    });
  });

  describe('11.3 / 11.4 Deep health diagnostic indicators (checkV2)', () => {
    it('marks overall status as down if database is down', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('DB down'));
      const health = await service.checkV2();
      expect(health.status).toBe('down');
      expect(health.checks.database.status).toBe('down');
    });

    it('marks overall status as down if Redis configuration error is present', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = undefined;

      const health = await service.checkV2();
      expect(health.status).toBe('down');
      expect(health.checks.redis.status).toBe('config_error');
      expect(health.checks.redis.configurationState).toBe('CONFIG_ERROR');
    });

    it('marks overall status as degraded if Redis is enabled but unreachable', async () => {
      process.env.REDIS_ENABLED = 'true';
      mockConfig.redisUrl = 'redis://localhost:6379';

      (Redis as unknown as jest.Mock).mockImplementationOnce(() => ({
        on: jest.fn(),
        connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        ping: jest.fn(),
        quit: jest.fn(),
      }));

      const health = await service.checkV2();
      expect(health.status).toBe('degraded');
      expect(health.checks.redis.status).toBe('down');
    });

    it('marks disk as unsupported if statfsSync returns undefined, avoiding fake 0 GB', async () => {
      (fs.statfsSync as unknown as jest.Mock).mockReturnValueOnce(undefined);

      const health = await service.checkV2();
      expect(health.checks.disk.status).toBe('unsupported');
      expect(health.checks.disk.freeDiskGB).toBeUndefined();
      expect(health.checks.disk.message).toContain('statfsSync unsupported');
    });

    it('marks disk as unsupported if statfsSync throws ENOSYS', async () => {
      const err: any = new Error('ENOSYS: function not implemented');
      err.code = 'ENOSYS';
      (fs.statfsSync as unknown as jest.Mock).mockImplementationOnce(() => {
        throw err;
      });

      const health = await service.checkV2();
      expect(health.checks.disk.status).toBe('unsupported');
      expect(health.checks.disk.freeDiskGB).toBeUndefined();
      expect(health.checks.disk.message).toContain('statfsSync unsupported');
    });

    it('marks outbox as degraded when failed events exceed threshold', async () => {
      mockPrisma.outboxEvent.count
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(12); // failed > 10

      const health = await service.checkV2();
      expect(health.status).toBe('degraded');
      expect(health.checks.outbox.status).toBe('degraded');
      expect(health.checks.outbox.failedEvents).toBe(12);
    });
  });
});
