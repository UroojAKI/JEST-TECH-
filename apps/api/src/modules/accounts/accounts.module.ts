import { Module } from '@nestjs/common';

import { AccountRepository } from './repositories/account.repository';
import { AccountsController } from './controllers/accounts.controller';
import { AccountsService } from './services/accounts.service';

import { PrismaService } from '../../database/prisma.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountRepository, PrismaService],
  exports: [AccountsService, AccountRepository],
})
export class AccountsModule {}
