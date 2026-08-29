import { Controller, Get, Header } from '@nestjs/common';
import {
  register,
  collectDefaultMetrics,
  Counter,
  Histogram,
} from 'prom-client';

if (!register.getSingleMetric('process_cpu_user_seconds_total')) {
  collectDefaultMetrics();
}

export const leadCreatedCounter =
  (register.getSingleMetric(
    'jest_crm_lead_created_total',
  ) as Counter<string>) ||
  new Counter({
    name: 'jest_crm_lead_created_total',
    help: 'Total number of leads created',
    labelNames: ['source'],
  });

export const apiDurationHistogram =
  (register.getSingleMetric(
    'jest_crm_api_request_duration_ms',
  ) as Histogram<string>) ||
  new Histogram({
    name: 'jest_crm_api_request_duration_ms',
    help: 'API request duration in milliseconds',
    labelNames: ['method', 'route', 'status'],
    buckets: [50, 100, 200, 500, 1000, 2000, 5000],
  });

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}
