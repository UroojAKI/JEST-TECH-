import { MetricsInterceptor } from '../../../common/interceptors/metrics.interceptor';
import { MetricsController, apiDurationHistogram } from '../../health/metrics.controller';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('Observability & Prometheus Telemetry (Iteration 18)', () => {
  let interceptor: MetricsInterceptor;
  let controller: MetricsController;

  beforeEach(() => {
    interceptor = new MetricsInterceptor();
    controller = new MetricsController();
  });

  const mockContext = (method = 'GET', url = '/api/v1/policies', statusCode = 200) => {
    const request = { method, url, route: { path: url } };
    const response = { statusCode };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
  };

  it('should expose Prometheus metrics containing jest_crm duration histogram', async () => {
    const metricsOutput = await controller.getMetrics();

    expect(metricsOutput).toBeDefined();
    expect(typeof metricsOutput).toBe('string');
    expect(metricsOutput).toContain('jest_crm_api_request_duration_ms');
  });

  it('should observe request duration on successful HTTP response', (done) => {
    const context = mockContext('GET', '/api/v1/leads', 200);
    const next: CallHandler = { handle: () => of({ success: true }) };

    const spy = jest.spyOn(apiDurationHistogram, 'labels');

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(spy).toHaveBeenCalledWith('GET', '/api/v1/leads', '200');
        done();
      },
    });
  });

  it('should observe request duration with error status code on exception', (done) => {
    const context = mockContext('POST', '/api/v1/policies', 500);
    const next: CallHandler = {
      handle: () => throwError(() => ({ status: 400, message: 'Invalid payload' })),
    };

    const spy = jest.spyOn(apiDurationHistogram, 'labels');

    interceptor.intercept(context, next).subscribe({
      error: () => {
        expect(spy).toHaveBeenCalledWith('POST', '/api/v1/policies', '400');
        done();
      },
    });
  });
});
