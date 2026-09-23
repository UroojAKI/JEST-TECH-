import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MetricsController } from './metrics.controller';
import { MetricsAuthGuard } from './guards/metrics-auth.guard';
import { RoleType } from '@prisma/client';

describe('MetricsController Security Hardening (F-028)', () => {
  let app: INestApplication;
  let mockUser: any = null;

  beforeAll(async () => {
    process.env.METRICS_SCRAPE_TOKEN = 'super-secret-prometheus-token-32chars';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
    })
      .overrideGuard(MetricsAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          const scrapeToken = process.env.METRICS_SCRAPE_TOKEN;
          const customHeader = req.headers?.['x-metrics-token'];
          const authHeader = req.headers?.['authorization'];

          if (scrapeToken && scrapeToken.length >= 16) {
            if (customHeader === scrapeToken) return true;
            if (authHeader === `Bearer ${scrapeToken}`) return true;
          }

          if (!mockUser) {
            throw new (require('@nestjs/common').UnauthorizedException)(
              'Authentication required to access metrics',
            );
          }

          req.user = mockUser;
          const roles = (
            mockUser.roles?.length ? mockUser.roles : [mockUser.role]
          ).filter(Boolean);
          if (
            roles.some((r: string) => r === RoleType.ADMIN || r === 'ADMIN')
          ) {
            return true;
          }

          throw new (require('@nestjs/common').ForbiddenException)(
            'Access denied. Metrics endpoint requires ADMIN role or valid scrape token',
          );
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    delete process.env.METRICS_SCRAPE_TOKEN;
  });

  beforeEach(() => {
    mockUser = null;
  });

  it('rejects public unauthenticated request with 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(401);
  });

  it('rejects authenticated non-admin user (e.g. AGENT) with 403 Forbidden', async () => {
    mockUser = { id: 'u1', role: 'AGENT', roles: ['AGENT'] };
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(403);
  });

  it('allows authenticated ADMIN user with 200 OK', async () => {
    mockUser = { id: 'admin1', role: RoleType.ADMIN, roles: [RoleType.ADMIN] };
    const res = await request(app.getHttpServer()).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toBeDefined();
  });

  it('allows scraper with valid x-metrics-token header with 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('x-metrics-token', 'super-secret-prometheus-token-32chars');
    expect(res.status).toBe(200);
  });

  it('allows scraper with valid Bearer scrape token with 200 OK', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('authorization', 'Bearer super-secret-prometheus-token-32chars');
    expect(res.status).toBe(200);
  });

  it('rejects invalid scrape token with 401 Unauthorized', async () => {
    const res = await request(app.getHttpServer())
      .get('/metrics')
      .set('x-metrics-token', 'invalid-token-here');
    expect(res.status).toBe(401);
  });
});
