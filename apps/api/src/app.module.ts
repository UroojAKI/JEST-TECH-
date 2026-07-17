import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

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
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { MotorAdminModule } from './modules/motor-admin/motor-admin.module';
import { ProposalModule } from './modules/proposal/proposal.module';
import { EndorsementModule } from './modules/endorsements/endorsements.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { BusinessIntelligenceModule } from './modules/business-intelligence/business-intelligence.module';
import { ReportsModule } from './modules/reports/reports.module';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    EventEmitterModule.forRoot(),
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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
