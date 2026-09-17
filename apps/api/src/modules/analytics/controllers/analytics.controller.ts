import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LeadAnalyticsService } from '../services/lead-analytics.service';
import { PolicyAnalyticsService } from '../services/policy-analytics.service';
import { ClaimAnalyticsService } from '../services/claim-analytics.service';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
import { RenewalAnalyticsService } from '../services/renewal-analytics.service';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
@Controller('analytics')
export class AnalyticsController {
  constructor(
    private readonly leadAnalytics: LeadAnalyticsService,
    private readonly policyAnalytics: PolicyAnalyticsService,
    private readonly claimAnalytics: ClaimAnalyticsService,
    private readonly revenueAnalytics: RevenueAnalyticsService,
    private readonly renewalAnalytics: RenewalAnalyticsService,
  ) {}

  @Get('leads')
  getLeadsAnalytics(@CurrentUser() user: RequestUser) {
    return this.leadAnalytics.getOverview(user);
  }

  @Get('policies')
  getPoliciesAnalytics(@CurrentUser() user: RequestUser) {
    return this.policyAnalytics.getOverview(user);
  }

  @Get('claims')
  getClaimsAnalytics(@CurrentUser() user: RequestUser) {
    return this.claimAnalytics.getOverview(user);
  }

  @Get('revenue')
  getRevenueAnalytics(@CurrentUser() user: RequestUser) {
    return this.revenueAnalytics.getOverview(user);
  }

  @Get('revenue/trend')
  getRevenueTrend(@CurrentUser() user: RequestUser) {
    return this.revenueAnalytics.getMonthlyTrend(user);
  }

  @Get('renewals')
  getRenewalsAnalytics(@CurrentUser() user: RequestUser) {
    return this.renewalAnalytics.getOverview(user);
  }
}
