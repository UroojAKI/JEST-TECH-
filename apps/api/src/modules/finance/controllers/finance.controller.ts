import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import {
  LedgerService,
  CreateJournalEntryDto,
} from '../accounting/services/ledger/ledger.service';
import { CommissionEngineService } from '../commission/services/commission-engine/commission-engine.service';
import { PaymentService } from '../revenue/services/payment/payment.service';
import {
  FinanceReconciliationService,
  ReconcilePaymentDto,
  DiscrepancyDto,
} from '../services/finance-reconciliation.service';
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
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({
    summary: 'Get finance dashboard metrics from authoritative records',
  })
  async getDashboardMetrics() {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const [
        todayReceipts,
        monthlyReceipts,
        accruedCommission,
        realizedCommission,
        accruedCommissionCount,
        pendingVerification,
        invoices,
      ] = await Promise.all([
        this.prisma.receipt.aggregate({
          where: { createdAt: { gte: startOfDay } },
          _sum: { amount: true },
        }),
        this.prisma.receipt.aggregate({
          where: { createdAt: { gte: startOfMonth } },
          _sum: { amount: true },
        }),
        this.prisma.commission.aggregate({
          where: { status: 'ACCRUED' },
          _sum: { amount: true },
        }),
        this.prisma.commission.aggregate({
          where: { status: 'REALIZED' },
          _sum: { amount: true },
        }),
        this.prisma.commission.count({ where: { status: 'ACCRUED' } }),
        this.prisma.motorPaymentRecord.count({
          where: { status: PaymentTrackingStatus.UNDER_PROCESS },
        }),
        this.prisma.invoice.findMany({
          select: {
            id: true,
            totalAmount: true,
            allocations: { select: { amount: true } },
          },
        }),
      ]);

      let outstandingPremium = 0;
      for (const invoice of invoices) {
        const paid = invoice.allocations.reduce(
          (sum, allocation) => sum + Number(allocation.amount || 0),
          0,
        );
        outstandingPremium += Math.max(0, Number(invoice.totalAmount || 0) - paid);
      }

      const todayCollections = Number(todayReceipts._sum.amount || 0);
      const monthlyCollections = Number(monthlyReceipts._sum.amount || 0);
      const totalCommissionAccrued = Number(
        accruedCommission._sum.amount || 0,
      );
      const totalCommissionRealized = Number(
        realizedCommission._sum.amount || 0,
      );

      return {
        // These values are derived from persisted financial records.
        todayCollections,
        monthlyCollections,
        monthlyGwp: null,
        outstandingPremium: Math.round(outstandingPremium * 100) / 100,
        totalCommissionAccrued,
        totalCommissionRealized,
        totalCommissionPaid: null,
        netProfitToday: null,
        payables: null,
        receivables: Math.round(outstandingPremium * 100) / 100,
        cashFlow: todayCollections,
        ledgerBalance: null,
        dataQuality: {
          monthlyGwp: 'NOT_AVAILABLE_FROM_CURRENT_AUTHORITATIVE_MODEL',
          totalCommissionPaid: 'NOT_AVAILABLE_FROM_CURRENT_AUTHORITATIVE_MODEL',
          netProfitToday: 'REQUIRES_ACCOUNT_MAPPING',
          payables: 'NOT_AVAILABLE_FROM_CURRENT_AUTHORITATIVE_MODEL',
          ledgerBalance: 'REQUIRES_ACCOUNT_BALANCE_MAPPING',
        },
        myWorkQueue: {
          pendingVerification,
          settlementsPending: null,
          commissionApproval: accruedCommissionCount,
          reconciliationQueue: pendingVerification,
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Unable to load authoritative finance dashboard metrics',
      );
    }
  }

  @Get('reconciliation-queue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({
    summary: 'Get finance reconciliation queue sorted by urgency (G020)',
  })
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
  @ApiOperation({
    summary:
      'Reconcile payment item against bank statement (advances quote to PAYMENT_CONFIRMED)',
  })
  async reconcilePayment(
    @Param('id') id: string,
    @Body() dto: ReconcilePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reconciliationService.reconcilePayment(id, user.id, dto);
  }

  @Post('reconciliation-queue/:id/discrepancy')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  @ApiOperation({
    summary: 'Flag discrepancy on payment item with mandatory reason',
  })
  async flagDiscrepancy(
    @Param('id') id: string,
    @Body() dto: DiscrepancyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reconciliationService.flagDiscrepancy(id, user.id, dto);
  }

  @Get('receipts')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
    RoleType.SALES_AGENT,
  )
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
    } catch {
      throw new InternalServerErrorException('Unable to load receipt register');
    }
  }

  @Get('payments')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Get payments register' })
  async getPayments(@Query('type') type?: string) {
    // The current Prisma schema does not expose a first-class Payment model.
    // Do not pretend this endpoint is implemented until the authoritative model exists.
    throw new NotFoundException(
      'Payment register is not implemented in the current financial schema',
    );
  }

  @Get('ledger')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
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
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
    RoleType.SALES_AGENT,
  )
  @ApiOperation({
    summary: 'Get commission register and manager override breakdown',
  })
  async getCommissions() {
    try {
      return await this.prisma.commission.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch {
      throw new InternalServerErrorException('Unable to load commission register');
    }
  }

  @Post('commissions/:id/approve')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Approve commission payout' })
  async approveCommission(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const commission = await this.prisma.commission.findUnique({
      where: { id },
    });

    if (!commission) {
      throw new NotFoundException(`Commission ${id} not found`);
    }

    if (commission.status !== 'ACCRUED') {
      throw new InternalServerErrorException(
        `Commission ${id} is not eligible for approval from status ${commission.status}`,
      );
    }

    // Current schema has no dedicated APPROVED state. REALIZED is the next
    // persisted financial state and is therefore used only after explicit approval.
    const approved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.commission.update({
        where: { id },
        data: { status: 'REALIZED' },
      });

      await tx.auditLog.create({
        data: {
          action: 'APPROVE',
          entity: 'Commission',
          entityId: id,
          userId: user.id,
          performedById: user.id,
          module: 'FINANCE',
          oldValue: { status: commission.status },
          newValue: { status: updated.status },
        },
      });

      return updated;
    });

    return {
      id: approved.id,
      status: approved.status,
      approvedAt: approved.updatedAt.toISOString(),
    };
  }

  @Get('settlements')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Get insurer settlement statements' })
  async getSettlements() {
    try {
      return await this.prisma.settlement.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    } catch {
      throw new InternalServerErrorException('Unable to load settlement register');
    }
  }

  @Get('incentives')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
    RoleType.SALES_AGENT,
  )
  @ApiOperation({ summary: 'Get employee sales & renewal incentives' })
  async getIncentives() {
    throw new NotFoundException(
      'Incentive register is not implemented in the current financial schema',
    );
  }

  @Get('vouchers/:id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({ summary: 'Get voucher details by ID' })
  async getVoucher(@Param('id') id: string) {
    throw new NotFoundException(
      `Voucher ${id} is not implemented in the current financial schema`,
    );
  }
}
