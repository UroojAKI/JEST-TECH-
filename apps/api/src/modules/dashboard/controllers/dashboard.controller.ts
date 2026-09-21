import {
  Controller,
  Get,
  UseGuards,
  UseInterceptors,
  Query,
} from '@nestjs/common';
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
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  getDashboard(@CurrentUser() user: RequestUser) {
    // DEF-002 fix: role is sourced exclusively from the authenticated JWT token.
    // Client-supplied role query parameters are NEVER accepted to prevent privilege escalation.
    return this.dashboardService.getDashboard(user.role, user.id);
  }

  @Get('admin')
  @Roles(RoleType.ADMIN)
  getAdminDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.ADMIN, user.id);
  }

  @Get('back-office')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getBackOfficeDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.BACK_OFFICE, user.id);
  }

  @Get('agent')
  @Roles(RoleType.AGENT)
  getAgentDashboard(@CurrentUser() user: RequestUser) {
    return this.dashboardService.getDashboard(RoleType.AGENT, user.id);
  }

  @Get('management/branch-gwp')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getBranchGwpBreakdown() {
    return this.dashboardService.getBranchGwpBreakdown();
  }

  @Get('management/insurers')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getInsurerMarketShare() {
    return this.dashboardService.getInsurerMarketShare();
  }

  @Get('management/leaderboard')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getSalesLeaderboard(@Query('limit') limit?: string) {
    return this.dashboardService.getSalesLeaderboard(
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
