import { Module } from '@nestjs/common';
import { CustomerAnalyticsCronService } from './services/customer-analytics-cron/customer-analytics-cron.service';

@Module({
  providers: [CustomerAnalyticsCronService],
  exports: [CustomerAnalyticsCronService],
})
export class AnalyticsModule {}
