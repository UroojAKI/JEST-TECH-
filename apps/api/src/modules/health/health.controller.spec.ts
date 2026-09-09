import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../../database/prisma.service';
import { HealthCheckService, PrismaHealthIndicator, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';

describe('HealthController Live HTTP Readiness & Liveness Probes (Task 7.4)', () => {
  let app: INestApplication;
  let mockHealthService: { checkReady: jest.Mock; checkV2: jest.Mock };

  beforeEach(async () => {
    mockHealthService = {
      checkReady: jest.fn().mockResolvedValue(true),
      checkV2: jest.fn().mockResolvedValue({ status: 'ok', timestamp: new Date().toISOString() }),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: mockHealthService },
        { provide: HealthCheckService, useValue: { check: jest.fn() } },
        { provide: PrismaHealthIndicator, useValue: { pingCheck: jest.fn() } },
        { provide: DiskHealthIndicator, useValue: { checkStorage: jest.fn() } },
        { provide: MemoryHealthIndicator, useValue: { checkHeap: jest.fn(), checkRSS: jest.fn() } },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  it('GET /health/live returns HTTP 200 with status alive', async () => {
    const res = await request(app.getHttpServer()).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
  });

  it('GET /health/ready returns HTTP 200 when all backend infrastructure dependencies are healthy', async () => {
    mockHealthService.checkReady.mockResolvedValueOnce(true);
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });

  it('GET /health/ready returns HTTP 503 when backend database or cache fails readiness check', async () => {
    mockHealthService.checkReady.mockResolvedValueOnce(false);
    const res = await request(app.getHttpServer()).get('/health/ready');
    expect(res.status).toBe(503);
  });
});
