import { Controller, Get, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { DashboardAnalyticsService } from './dashboard-analytics.service';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';

@Controller('dashboards')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardAnalyticsController {
  constructor(private readonly dashboardService: DashboardAnalyticsService) {}

  private getActorCompanyId(req: any): string {
    const companyId = req?.user?.companyId || req?.user?.organizationId;
    if (!companyId || typeof companyId !== 'string' || !companyId.trim()) {
      throw new ForbiddenException('Tenant organizational context is required');
    }
    return companyId.trim();
  }

  @Get('sales')
  @Roles(RoleType.AGENT, RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getSalesDashboard(@Req() req) {
    const companyId = this.getActorCompanyId(req);
    return this.dashboardService.getSalesMetrics(req.user.id, companyId);
  }

  @Get('sales-manager')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getSalesManagerDashboard(@Req() req) {
    const companyId = this.getActorCompanyId(req);
    return this.dashboardService.getSalesManagerMetrics(
      req.user.id,
      req.user.branchId,
      companyId,
    );
  }

  @Get('renewals')
  @Roles(RoleType.BACK_OFFICE, RoleType.ADMIN)
  async getRenewalDashboard(@Req() req) {
    const companyId = this.getActorCompanyId(req);
    return this.dashboardService.getRenewalMetrics(req.user.id, companyId);
  }
}
