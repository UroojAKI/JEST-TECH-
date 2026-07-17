import { Module } from '@nestjs/common';

import { AccountRepository } from './repositories/account.repository';
import { AccountsController } from './controllers/accounts.controller';
import { AccountsService } from './services/accounts.service';

@Module({
  controllers: [AccountsController],
  providers: [AccountsService, AccountRepository],
  exports: [AccountsService, AccountRepository],
})
export class AccountsModule {}
