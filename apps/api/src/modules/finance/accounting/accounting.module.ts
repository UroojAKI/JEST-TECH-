import { Module } from '@nestjs/common';
import { LedgerService } from './services/ledger/ledger.service';
import { FinanceReconciliationService } from '../services/finance-reconciliation.service';
import { FinanceController } from '../controllers/finance.controller';
import { CommissionModule } from '../commission/commission.module';
import { RevenueModule } from '../revenue/revenue.module';

import { SettlementService } from '../services/settlement.service';

@Module({
  imports: [CommissionModule, RevenueModule],
  controllers: [FinanceController],
  providers: [LedgerService, FinanceReconciliationService, SettlementService],
  exports: [LedgerService, FinanceReconciliationService, SettlementService],
})
export class AccountingModule {}
