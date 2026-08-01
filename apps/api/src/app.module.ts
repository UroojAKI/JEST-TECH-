import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { CacheModule as NestCacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { ThrottlerModule } from '@nestjs/throttler';

import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigurationModule } from './modules/platform/configuration/configuration.module';
import { RateLimitingModule } from './modules/platform/rate-limiting/rate-limiting.module';
import { ObservabilityModule } from './modules/platform/observability/observability.module';
import { CacheModule } from './modules/platform/cache/cache.module';

import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { LeadsModule } from './modules/leads/leads.module';
import { QuotationModule } from './modules/quotation/quotation.module';
import { PoliciesModule } from './modules/policies/policies.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { NotificationsModule } from './modules/platform/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MotorAdminModule } from './modules/motor-admin/motor-admin.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { EndorsementModule } from './modules/endorsements/endorsements.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { BusinessIntelligenceModule } from './modules/business-intelligence/business-intelligence.module';
import { ReportsModule } from './modules/platform/reporting/reports.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { AuditModule } from './modules/platform/audit/audit.module';
import { QueueModule } from './modules/platform/queue/queue.module';
import { SearchModule } from './modules/platform/search/search.module';
import { WorkflowModule } from './modules/platform/workflow/workflow.module';
import { AdministrationModule } from './modules/administration/administration.module';
import { AccountingModule } from './modules/finance/accounting/accounting.module';
import { RevenueModule } from './modules/finance/revenue/revenue.module';
import { CommissionModule } from './modules/finance/commission/commission.module';
import { Customer360Module } from './modules/customer/customer-360/customer-360.module';
import { CommunicationModule } from './modules/customer/communication/communication.module';
import { AnalyticsModule as CustomerAnalyticsModule } from './modules/customer/analytics/analytics.module';
import { DataWarehouseModule } from './modules/bi/data-warehouse/data-warehouse.module';
import { DashboardsModule } from './modules/bi/dashboards/dashboards.module';
import { ForecastingModule } from './modules/bi/forecasting/forecasting.module';
import { IntegrationsModule } from './modules/platform/integrations/integrations.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { DashboardRegistryModule } from './modules/dashboard-registry/dashboard-registry.module';
import { WorkspaceModule } from './modules/workspace/workspace.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigurationModule,
    RateLimitingModule,
    ObservabilityModule,
    CacheModule,
    NestCacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => {
        if (process.env.REDIS_ENABLED === 'true') {
          try {
            const store = await redisStore({
              url: process.env.REDIS_URL || 'redis://localhost:6380',
              ttl: 60,
            });
            return { store: store as any };
          } catch (err) {
            console.warn('[CacheModule] Redis connection failed, falling back to in-memory store.');
          }
        }
        return { ttl: 60 };
      },
    }),
    ThrottlerModule.forRootAsync({
      useFactory: () => ({
        throttlers: [
          {
            name: 'default',
            ttl: 60000,
            limit: 1000,
          },
        ],
      }),
    }),
    EventEmitterModule.forRoot({
      maxListeners: 25,
      verboseMemoryLeak: true,
    }),
    ScheduleModule.forRoot(),

    DatabaseModule,
    HealthModule,
    UsersModule,
    AuthModule,
    ContactsModule,
    AccountsModule,
    LeadsModule,
    QuotationModule,
    PoliciesModule,
    ClaimsModule,
    DashboardModule,
    NotificationsModule,
    AnalyticsModule,
    DocumentsModule,
    MotorAdminModule,
    ProposalModule,
    EndorsementModule,
    WarehouseModule,
    BusinessIntelligenceModule,
    ReportsModule,
    AuditModule,
    QueueModule,
    SearchModule,
    WorkflowModule,
    AdministrationModule,
    AccountingModule,
    RevenueModule,
    CommissionModule,
    Customer360Module,
    CommunicationModule,
    CustomerAnalyticsModule,
    DataWarehouseModule,
    DashboardsModule,
    ForecastingModule,
    IntegrationsModule,
    OrganizationModule,
    DashboardRegistryModule,
    WorkspaceModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(CorrelationIdMiddleware, RequestLoggerMiddleware)
      .forRoutes('*');
  }
}
