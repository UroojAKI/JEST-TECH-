import { Module } from '@nestjs/common';
import { DashboardAnalyticsService } from './services/dashboard-analytics/dashboard-analytics.service';
import { DashboardAnalyticsController } from './services/dashboard-analytics/dashboard-analytics.controller';

@Module({
  providers: [DashboardAnalyticsService],
  controllers: [DashboardAnalyticsController],
})
export class DashboardsModule {}
