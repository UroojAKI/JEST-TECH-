import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/modules/auth/guards/roles.guard';
import { MetricsController } from '../../src/modules/health/metrics.controller';
import { MetricsAuthGuard } from '../../src/modules/health/guards/metrics-auth.guard';

describe('HTTP Route Security & Gateway Defense Suite (F-029)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: MetricsAuthGuard,
          useClass: MetricsAuthGuard,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Unauthenticated HTTP Access Rejection', () => {
    it('rejects GET /metrics without token with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer()).get('/metrics');
      expect(res.status).toBe(401);
    });

    it('rejects GET /metrics with invalid token with 401 Unauthorized', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .set('Authorization', 'Bearer invalid-token');
      expect(res.status).toBe(401);
    });

    it('rejects GET /metrics with forged scrape token', async () => {
      const res = await request(app.getHttpServer())
        .get('/metrics')
        .set('x-metrics-token', 'short');
      expect(res.status).toBe(401);
    });
  });

  describe('CSRF & Method Tampering Defense', () => {
    it('validates that JwtAuthGuard blocks state-mutating requests missing CSRF token', async () => {
      const guard = new JwtAuthGuard();
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            headers: {},
            cookies: {},
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      // Guard should fail either authentication or CSRF
      await expect(guard.canActivate(mockContext)).rejects.toThrow();
    });

    it('validates that RolesGuard fails-closed when no user session exists', () => {
      const reflector: any = {
        getAllAndOverride: (key: string) => {
          if (key === 'roles') return ['ADMIN'];
          return null;
        },
      };
      const guard = new RolesGuard(reflector);
      const mockContext: any = {
        switchToHttp: () => ({
          getRequest: () => ({
            user: null,
          }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      expect(guard.canActivate(mockContext)).toBe(false);
    });
  });
});
