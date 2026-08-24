import { Module } from '@nestjs/common';

import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [TerminusModule],
  controllers: [HealthController, MetricsController],
  providers: [HealthService],
})
export class HealthModule {}
