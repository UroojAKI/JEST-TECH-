import { Module } from '@nestjs/common';

import { ContactRepository } from './repositories/contact.repository';
import { ContactsController } from './controllers/contacts.controller';
import { ContactsService } from './services/contacts.service';
import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [ContactsController],
  providers: [ContactsService, ContactRepository, PrismaService],
  exports: [ContactsService],
})
export class ContactsModule {}

