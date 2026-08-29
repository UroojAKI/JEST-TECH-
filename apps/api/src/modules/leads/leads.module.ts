import { Module } from '@nestjs/common';

import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../platform/reporting/reports.module';

import { LeadRepository } from './repositories/lead.repository';
import { LeadsController } from './controllers/leads.controller';
import { LeadsService } from './services/leads.service';
import { LeadReportProvider } from './providers/lead-report.provider';
import { ScoringModule } from './scoring/scoring.module';
import { DeduplicationModule } from './deduplication/deduplication.module';
import { RoutingModule } from './routing/routing.module';
import { SlaModule } from './sla/sla.module';
import { LeadAssignmentService } from './services/lead-assignment.service';
import { LeadCompletionService } from './services/lead-completion.service';

@Module({
  imports: [
    ContactsModule,
    AccountsModule,
    UsersModule,
    ReportsModule,
    ScoringModule,
    DeduplicationModule,
    RoutingModule,
    SlaModule,
  ],
  controllers: [LeadsController],
  providers: [
    LeadsService,
    LeadAssignmentService,
    LeadCompletionService,
    LeadRepository,
    LeadReportProvider,
  ],
  exports: [
    LeadsService,
    LeadAssignmentService,
    LeadCompletionService,
    LeadRepository,
    LeadReportProvider,
  ],
})
export class LeadsModule {}
