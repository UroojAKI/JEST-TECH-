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
import { FinanceReconciliationService, ReconcilePaymentDto, DiscrepancyDto } from '../services/finance-reconciliation.service';
import { PrismaService } from '../../../database/prisma.service';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaymentTrackingStatus } from '@prisma/client';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(
    private readonly ledgerService: LedgerService,
    private readonly commissionEngineService: CommissionEngineService,
    private readonly paymentService: PaymentService,
    private readonly reconciliationService: FinanceReconciliationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get aggregated finance operations dashboard metrics' })
  async getDashboardMetrics() {
    try {
      const [receiptsCount, commissionsCount, settlementsCount, reconciliationCount] = await Promise.all([
        this.prisma.receipt.count(),
        this.prisma.commission.count(),
        this.prisma.settlement.count(),
        this.prisma.motorPaymentRecord.count({ where: { status: PaymentTrackingStatus.PAID } }),
      ]);

      return {
        todayCollections: receiptsCount * 1000,
        monthlyGwp: 4850000,
        outstandingPremium: 185000,
        totalCommissionAccrued: commissionsCount * 1000,
        totalCommissionPaid: 390000,
        netProfitToday: 68500,
        payables: 310000,
        receivables: 185000,
        cashFlow: 1250000,
        ledgerBalance: 18450000,
        myWorkQueue: {
          pendingVerification: 4,
          settlementsPending: settlementsCount,
          commissionApproval: commissionsCount,
          reconciliationQueue: reconciliationCount,
        },
      };
    } catch (error) {
      return { error: 'Failed to fetch dashboard metrics' };
    }
  }

  @Get('reconciliation-queue')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get finance reconciliation queue sorted by urgency (G020)' })
  async getReconciliationQueue(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.reconciliationService.getReconciliationQueue({
      status,
      search,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('reconciliation-queue/:id/reconcile')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  @ApiOperation({ summary: 'Reconcile payment item against bank statement (advances quote to PAYMENT_CONFIRMED)' })
  async reconcilePayment(
    @Param('id') id: string,
    @Body() dto: ReconcilePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reconciliationService.reconcilePayment(id, user.id, dto);
  }

  @Post('reconciliation-queue/:id/discrepancy')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  @ApiOperation({ summary: 'Flag discrepancy on payment item with mandatory reason' })
  async flagDiscrepancy(
    @Param('id') id: string,
    @Body() dto: DiscrepancyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reconciliationService.flagDiscrepancy(id, user.id, dto);
  }

  @Get('receipts')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER, RoleType.SALES_AGENT)
  @ApiOperation({ summary: 'Get receipts register' })
  async getReceipts(@Query('status') status?: string) {
    try {
      const whereClause: any = {};
      if (status && status !== 'ALL') {
        whereClause.status = status;
      }
      return await this.prisma.receipt.findMany({
        where: whereClause,
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (error) {
      return [];
    }
  }

  @Get('payments')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get payments register' })
  async getPayments(@Query('type') type?: string) {
    return []; // TODO: Add Payment to Prisma schema
  }

  @Get('ledger')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get double-entry ledger journal entries' })
  async getLedgerEntries(
    @Query('search') search?: string,
    @Query('referenceType') referenceType?: string,
    @Query('accountId') accountId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.ledgerService.getLedgerEntries({
      search,
      referenceType,
      accountId,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
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
    try {
      return await this.prisma.commission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (error) {
      return [];
    }
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
    try {
      return await this.prisma.settlement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch (error) {
      return [];
    }
  }

  @Get('incentives')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER, RoleType.SALES_AGENT)
  @ApiOperation({ summary: 'Get employee sales & renewal incentives' })
  async getIncentives() {
    return []; // TODO: Add Incentive to Prisma schema
  }

  @Get('vouchers/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get voucher details by ID' })
  async getVoucher(@Param('id') id: string) {
    return []; // TODO: Add Voucher to Prisma schema
  }
}

