import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { LedgerService, CreateJournalEntryDto } from '../accounting/services/ledger/ledger.service';
import { CommissionEngineService } from '../commission/services/commission-engine/commission-engine.service';
import { PaymentService } from '../revenue/services/payment/payment.service';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly commissionEngineService: CommissionEngineService,
    private readonly paymentService: PaymentService,
  ) {}

  @Get('dashboard')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get aggregated finance operations dashboard metrics' })
  async getDashboardMetrics() {
    return {
      todayCollections: 248500,
      monthlyGwp: 4850000,
      outstandingPremium: 185000,
      totalCommissionAccrued: 485000,
      totalCommissionPaid: 390000,
      netProfitToday: 68500,
      payables: 310000,
      receivables: 185000,
      cashFlow: 1250000,
      ledgerBalance: 18450000,
      myWorkQueue: {
        pendingVerification: 4,
        settlementsPending: 2,
        commissionApproval: 6,
        reconciliationQueue: 3,
      },
    };
  }

  @Get('receipts')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER, RoleType.SALES_AGENT)
  @ApiOperation({ summary: 'Get receipts register' })
  async getReceipts(@Query('status') status?: string) {
    const receipts = [
      {
        id: 'RCT-2026-001',
        receiptNumber: 'RCT-2026-001',
        customerName: 'Rahul Patil',
        policyNumber: 'POL-001048',
        amount: 16545,
        paymentMode: 'UPI / Razorpay',
        status: 'VERIFIED',
        receivedBy: 'Rajesh Sharma',
        date: '2026-07-22',
        txnRef: 'TXN-99182701',
      },
      {
        id: 'RCT-2026-002',
        receiptNumber: 'RCT-2026-002',
        customerName: 'Acme Logistics Pvt Ltd',
        policyNumber: 'POL-001049',
        amount: 450000,
        paymentMode: 'NEFT / Bank Transfer',
        status: 'RECONCILED',
        receivedBy: 'Sunil Verma',
        date: '2026-07-21',
        txnRef: 'HDFC-N9928172',
      },
      {
        id: 'RCT-2026-003',
        receiptNumber: 'RCT-2026-003',
        customerName: 'Sunita Kulkarni',
        policyNumber: 'POL-001050',
        amount: 28000,
        paymentMode: 'Credit Card',
        status: 'PENDING',
        receivedBy: 'System Online',
        date: '2026-07-24',
        txnRef: 'CC-77182901',
      },
    ];

    if (status && status !== 'ALL') {
      return receipts.filter((r) => r.status === status);
    }

    return receipts;
  }

  @Get('payments')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get payments register' })
  async getPayments(@Query('type') type?: string) {
    const payments = [
      {
        id: 'PAY-2026-101',
        paymentNumber: 'PAY-2026-101',
        payee: 'ICICI Lombard General Insurance',
        type: 'INSURER_SETTLEMENT',
        amount: 384500,
        mode: 'NEFT Batch',
        status: 'COMPLETED',
        date: '2026-07-20',
      },
      {
        id: 'PAY-2026-102',
        paymentNumber: 'PAY-2026-102',
        payee: 'Rajesh Sharma (Sales Agent)',
        type: 'COMMISSION_DISBURSAL',
        amount: 14850,
        mode: 'Direct Bank Transfer',
        status: 'COMPLETED',
        date: '2026-07-22',
      },
      {
        id: 'PAY-2026-103',
        paymentNumber: 'PAY-2026-103',
        payee: 'Vikram Mehta',
        type: 'CUSTOMER_REFUND',
        amount: 4200,
        mode: 'UPI Refund',
        status: 'PENDING_APPROVAL',
        date: '2026-07-23',
      },
    ];

    if (type && type !== 'ALL') {
      return payments.filter((p) => p.type === type);
    }

    return payments;
  }

  @Get('ledger')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get double-entry ledger journal entries' })
  async getLedgerEntries() {
    return [
      {
        id: 'JE-2026-001',
        entryNumber: 'JE-2026-001',
        date: '2026-07-22',
        description: 'Premium Receipt POL-001048 - Rahul Patil',
        referenceType: 'POLICY_PAYMENT',
        referenceId: 'POL-001048',
        status: 'POSTED',
        lines: [
          { accountName: 'HDFC Bank Collection A/C', debit: 16545, credit: 0, accountType: 'ASSET' },
          { accountName: 'Premium Income - Motor', debit: 0, credit: 16545, accountType: 'REVENUE' },
        ],
      },
      {
        id: 'JE-2026-002',
        entryNumber: 'JE-2026-002',
        date: '2026-07-22',
        description: 'Commission Accrual POL-001048',
        referenceType: 'COMMISSION_ACCRUAL',
        referenceId: 'POL-001048',
        status: 'POSTED',
        lines: [
          { accountName: 'Commission Expense', debit: 1654.5, credit: 0, accountType: 'EXPENSE' },
          { accountName: 'Commission Payable - Agent', debit: 0, credit: 1654.5, accountType: 'LIABILITY' },
        ],
      },
    ];
  }

  @Post('ledger/journal')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  @ApiOperation({ summary: 'Post new double-entry journal entry' })
  async postJournalEntry(@Body() dto: CreateJournalEntryDto) {
    return this.ledgerService.postEntry(dto);
  }

  @Get('commissions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER, RoleType.SALES_AGENT)
  @ApiOperation({ summary: 'Get commission register and manager override breakdown' })
  async getCommissions() {
    return [
      {
        id: 'COMM-1001',
        policyNumber: 'POL-001048',
        customerName: 'Rahul Patil',
        agentName: 'Rajesh Sharma',
        roleTier: 'AGENT',
        grossPremium: 16545,
        commissionPercent: 10,
        commissionAmount: 1654.5,
        status: 'REALIZED',
        payoutStatus: 'APPROVED',
        createdAt: '2026-07-22',
      },
      {
        id: 'COMM-1002',
        policyNumber: 'POL-001048',
        customerName: 'Rahul Patil',
        agentName: 'Sunil Verma (Branch Mgr)',
        roleTier: 'BRANCH_MANAGER',
        grossPremium: 16545,
        commissionPercent: 2,
        commissionAmount: 330.9,
        status: 'REALIZED',
        payoutStatus: 'PENDING_APPROVAL',
        createdAt: '2026-07-22',
      },
    ];
  }

  @Post('commissions/:id/approve')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Approve commission payout' })
  async approveCommission(@Param('id') id: string) {
    return { id, status: 'APPROVED', approvedAt: new Date().toISOString() };
  }

  @Get('settlements')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get insurer settlement statements' })
  async getSettlements() {
    return [
      {
        id: 'SETTLE-2026-01',
        insurerName: 'ICICI Lombard',
        period: 'July 2026 (Fortnight 1)',
        grossPremiumCollected: 1250000,
        commissionRetained: 125000,
        netPayable: 1125000,
        status: 'SETTLED',
        settledDate: '2026-07-20',
      },
      {
        id: 'SETTLE-2026-02',
        insurerName: 'HDFC ERGO',
        period: 'July 2026 (Fortnight 2)',
        grossPremiumCollected: 850000,
        commissionRetained: 85000,
        netPayable: 765000,
        status: 'PENDING_SETTLEMENT',
        settledDate: null,
      },
    ];
  }

  @Get('incentives')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER, RoleType.SALES_AGENT)
  @ApiOperation({ summary: 'Get employee sales & renewal incentives' })
  async getIncentives() {
    return [
      {
        id: 'INC-901',
        employeeName: 'Rajesh Sharma',
        role: 'Sales Executive',
        type: 'MONTHLY_TARGET_BONUS',
        targetAmount: 500000,
        achievedAmount: 620000,
        incentiveAmount: 15000,
        status: 'APPROVED',
      },
      {
        id: 'INC-902',
        employeeName: 'Priya Nair',
        role: 'Renewal Executive',
        type: 'RENEWAL_RETENTION_BONUS',
        targetAmount: 85,
        achievedAmount: 92,
        incentiveAmount: 8500,
        status: 'PENDING',
      },
    ];
  }

  @Get('vouchers/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get voucher details by ID' })
  async getVoucher(@Param('id') id: string) {
    return {
      id,
      voucherNumber: id,
      date: new Date().toISOString().split('T')[0],
      type: 'PAYMENT_VOUCHER',
      status: 'APPROVED',
      amount: 45000,
      payee: 'System Partner',
      narration: `Voucher reference details for ${id}`,
    };
  }
}

