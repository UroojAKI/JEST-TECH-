import { Module } from '@nestjs/common';

import { QuotationModule } from '../quotation/quotation.module';
import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ReportsModule } from '../platform/reporting/reports.module';

import { PolicyRepository } from './repositories/policy.repository';
import { PoliciesController } from './controllers/policies.controller';

// CQRS Commands
import { IssuePolicyService } from './services/commands/issue-policy.service';
import { CancelPolicyService } from './services/commands/cancel-policy.service';
import { RenewPolicyService } from './services/commands/renew-policy.service';

// CQRS Queries
import { GetPolicyService } from './services/queries/get-policy.service';
import { GetPolicyHistoryService } from './services/queries/get-policy-history.service';

// Policy Domain Service
import { PolicyDomainService } from './domain/policy.domain-service';

// Report Providers
import { PolicyReportProvider } from './providers/policy-report.provider';
import { RevenueReportProvider } from './providers/revenue-report.provider';

import { BullModule } from '@nestjs/bullmq';
import { RenewalEngineService } from './services/renewal-engine.service';
import { RenewalReminderProcessor } from './processors/renewal-reminder.processor';
import { RenewalSchedulerCron } from './crons/renewal-scheduler.cron';
import { BackOfficeController } from './controllers/back-office.controller';
import { BackOfficeQueueService } from './services/queries/back-office-queue.service';

@Module({
  imports: [
    QuotationModule, 
    ContactsModule, 
    AccountsModule, 
    ReportsModule,
    BullModule.registerQueue({ name: 'renewal-reminders' }),
  ],
  controllers: [PoliciesController, BackOfficeController],
  providers: [
    PolicyRepository,
    PolicyDomainService,
    BackOfficeQueueService,
    // CQRS Commands
    IssuePolicyService,
    CancelPolicyService,
    RenewPolicyService,
    // CQRS Queries
    GetPolicyService,
    GetPolicyHistoryService,
    // Report Providers
    PolicyReportProvider,
    RevenueReportProvider,
    // Renewal Automation
    RenewalEngineService,
    RenewalReminderProcessor,
    RenewalSchedulerCron,
  ],
  exports: [
    GetPolicyService,
    PolicyRepository,
    PolicyDomainService,
    PolicyReportProvider,
    RevenueReportProvider,
  ],
})
export class PoliciesModule {}
