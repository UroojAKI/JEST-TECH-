import { Module } from '@nestjs/common';

import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersModule } from '../users/users.module';
import { ReportsModule } from '../platform/reporting/reports.module';

import { LeadRepository } from './repositories/lead.repository';
import { LeadsController } from './controllers/leads.controller';
import { LeadsService } from './services/leads.service';
import { LeadReportProvider } from './providers/lead-report.provider';

@Module({
  imports: [ContactsModule, AccountsModule, UsersModule, ReportsModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadRepository, LeadReportProvider],
  exports: [LeadsService, LeadRepository, LeadReportProvider],
})
export class LeadsModule {}
