import { Module } from '@nestjs/common';
import { LedgerService } from './services/ledger/ledger.service';
import { FinanceController } from '../controllers/finance.controller';
import { CommissionModule } from '../commission/commission.module';
import { RevenueModule } from '../revenue/revenue.module';

@Module({
  imports: [CommissionModule, RevenueModule],
  controllers: [FinanceController],
  providers: [LedgerService],
  exports: [LedgerService],
})
export class AccountingModule {}
