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
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getDashboard(user.role, user.id, companyId);
  }

  @Get('admin')
  @Roles(RoleType.ADMIN)
  getAdminDashboard(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getDashboard(RoleType.ADMIN, user.id, companyId);
  }

  @Get('back-office')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getBackOfficeDashboard(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getDashboard(
      RoleType.BACK_OFFICE,
      user.id,
      companyId,
    );
  }

  @Get('agent')
  @Roles(RoleType.AGENT)
  getAgentDashboard(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getDashboard(RoleType.AGENT, user.id, companyId);
  }

  @Get('management/branch-gwp')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getBranchGwpBreakdown(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getBranchGwpBreakdown(companyId);
  }

  @Get('management/insurers')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getInsurerMarketShare(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getInsurerMarketShare(companyId);
  }

  @Get('management/leaderboard')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  getSalesLeaderboard(
    @CurrentUser() user: RequestUser,
    @Query('limit') limit?: string,
  ) {
    const companyId = user.companyId || user.organizationId;
    return this.dashboardService.getSalesLeaderboard(
      limit ? parseInt(limit, 10) : 10,
      companyId,
    );
  }
}
