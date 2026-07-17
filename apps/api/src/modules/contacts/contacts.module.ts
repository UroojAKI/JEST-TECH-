import { Module } from '@nestjs/common';

import { ContactRepository } from './repositories/contact.repository';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactRepository],
  exports: [ContactsService],
})
export class ContactsModule {}
