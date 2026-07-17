import { Module } from '@nestjs/common';

import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { UsersModule } from '../users/users.module';

import { LeadRepository } from './repositories/lead.repository';
import { LeadsController } from './controllers/leads.controller';
import { LeadsService } from './services/leads.service';

@Module({
  imports: [ContactsModule, AccountsModule, UsersModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadRepository],
  exports: [LeadsService, LeadRepository],
})
export class LeadsModule {}
