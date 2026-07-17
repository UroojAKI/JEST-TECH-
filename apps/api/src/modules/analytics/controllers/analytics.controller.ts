import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LeadAnalyticsService } from '../services/lead-analytics.service';
import { PolicyAnalyticsService } from '../services/policy-analytics.service';
import { ClaimAnalyticsService } from '../services/claim-analytics.service';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
import { RenewalAnalyticsService } from '../services/renewal-analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
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
  getLeadsAnalytics() {
    return this.leadAnalytics.getOverview();
  }

  @Get('policies')
  getPoliciesAnalytics() {
    return this.policyAnalytics.getOverview();
  }

  @Get('claims')
  getClaimsAnalytics() {
    return this.claimAnalytics.getOverview();
  }

  @Get('revenue')
  getRevenueAnalytics() {
    return this.revenueAnalytics.getOverview();
  }

  @Get('renewals')
  getRenewalsAnalytics() {
    return this.renewalAnalytics.getOverview();
  }
}
