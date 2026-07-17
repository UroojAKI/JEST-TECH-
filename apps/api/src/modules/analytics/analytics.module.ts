import { Module } from '@nestjs/common';
import { AnalyticsController } from './controllers/analytics.controller';
import { ContactAnalyticsService } from './services/contact-analytics.service';
import { LeadAnalyticsService } from './services/lead-analytics.service';
import { QuotationAnalyticsService } from './services/quotation-analytics.service';
import { PolicyAnalyticsService } from './services/policy-analytics.service';
import { ClaimAnalyticsService } from './services/claim-analytics.service';
import { RenewalAnalyticsService } from './services/renewal-analytics.service';
import { RevenueAnalyticsService } from './services/revenue-analytics.service';
import { DashboardAnalyticsService } from './services/dashboard-analytics.service';

@Module({
  controllers: [AnalyticsController],
  providers: [
    ContactAnalyticsService,
    LeadAnalyticsService,
    QuotationAnalyticsService,
    PolicyAnalyticsService,
    ClaimAnalyticsService,
    RenewalAnalyticsService,
    RevenueAnalyticsService,
    DashboardAnalyticsService,
  ],
  exports: [
    ContactAnalyticsService,
    LeadAnalyticsService,
    QuotationAnalyticsService,
    PolicyAnalyticsService,
    ClaimAnalyticsService,
    RenewalAnalyticsService,
    RevenueAnalyticsService,
    DashboardAnalyticsService,
  ],
})
export class AnalyticsModule {}
