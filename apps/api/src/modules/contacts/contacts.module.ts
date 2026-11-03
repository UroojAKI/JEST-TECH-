import { Module } from '@nestjs/common';

import { ContactRepository } from './repositories/contact.repository';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';
import { AgentsModule } from '../agents/agents.module';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule, AgentsModule],
  controllers: [ContactsController],
  providers: [ContactsService, ContactRepository],
  exports: [ContactsService],
})
export class ContactsModule {}
