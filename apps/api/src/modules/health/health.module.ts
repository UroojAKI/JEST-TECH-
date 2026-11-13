import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';

import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { MetricsController } from './metrics.controller';
import { MetricsAuthGuard } from './guards/metrics-auth.guard';

@Module({
  imports: [TerminusModule, DocumentsModule],
  controllers: [HealthController, MetricsController],
  providers: [HealthService, MetricsAuthGuard],
})
export class HealthModule {}
