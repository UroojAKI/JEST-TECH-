import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { DashboardService } from '../services/dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@UseInterceptors(CacheInterceptor)
@CacheTTL(60)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(user.role, user.id);
  }

  @Get('super-admin')
  @Roles(RoleType.SUPER_ADMIN)
  getSuperAdminDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.SUPER_ADMIN, user.id);
  }

  @Get('admin')
  @Roles(RoleType.ADMIN)
  getAdminDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.ADMIN, user.id);
  }

  @Get('manager')
  @Roles(RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER)
  getManagerDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.BRANCH_MANAGER, user.id);
  }

  @Get('agent')
  @Roles(RoleType.SALES_AGENT)
  getAgentDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.SALES_AGENT, user.id);
  }
}
