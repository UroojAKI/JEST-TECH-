import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardAnalyticsController {
  constructor(private readonly dashboardService: DashboardAnalyticsService) {}

  @Get('sales')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getSalesDashboard(@Req() req) {
    return this.dashboardService.getSalesMetrics(req.user.id);
  }

  @Get('sales-manager')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getSalesManagerDashboard(@Req() req) {
    return this.dashboardService.getSalesManagerMetrics(
      req.user.id,
      req.user.branchId,
    );
  }

  @Get('renewals')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getRenewalDashboard(@Req() req) {
    return this.dashboardService.getRenewalMetrics(req.user.id);
  }
}
