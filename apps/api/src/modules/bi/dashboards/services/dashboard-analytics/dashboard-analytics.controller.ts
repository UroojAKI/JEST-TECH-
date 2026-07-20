import {
  Controller,
  Get,
  Param,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';

@Controller('dashboards')
@UseGuards(JwtAuthGuard)
@UseInterceptors(CacheInterceptor)
export class DashboardAnalyticsController {
  constructor(private readonly dashboardService: DashboardAnalyticsService) {}

  @Get(':id')
  @CacheKey('dashboard_data')
  @CacheTTL(60000) // 1 minute TTL
  async getDashboard(@Param('id') id: string) {
    return this.dashboardService.getDashboardData(id);
  }
}
