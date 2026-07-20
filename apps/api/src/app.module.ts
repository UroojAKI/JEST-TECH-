import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';

import configuration from './config/configuration';
import { validationSchema } from './config/validation';

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
import { AuditModule } from './modules/platform/audit/audit.module';
import { QueueModule } from './modules/platform/queue/queue.module';
import { SearchModule } from './modules/platform/search/search.module';
import { WorkflowModule } from './modules/platform/workflow/workflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
        storage: new ThrottlerStorageRedisService(config.get<string>('redis.url')),
      }),
    }),

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
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
