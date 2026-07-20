import { Module } from '@nestjs/common';
import { LedgerService } from './services/ledger/ledger.service';

@Module({
  providers: [LedgerService]
})
export class AccountingModule {}
