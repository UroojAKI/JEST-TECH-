import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import type { Response } from 'express';
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
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get finance dashboard metrics and queue counts' })
  async getDashboardMetrics(@CurrentUser() actor: RequestUser) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const companyId = actor.companyId || (actor as any).organizationId;

    // 1. Receipts today (scoped to customers of this company)
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true },
    });
    const companyCustomerIds = companyCustomers.map((c) => c.id);

    const receiptsToday = await this.prisma.receipt.findMany({
      where: {
        createdAt: { gte: todayStart },
        status: { not: 'BOUNCED' },
        ...(companyCustomerIds.length > 0
          ? { customerId: { in: companyCustomerIds } }
          : {}),
      },
      select: { amount: true },
    });
    const todayCollections = receiptsToday.reduce(
      (acc, r) => acc + Number(r.amount),
      0,
    );

    // 2. Monthly GWP (Policies issued this month for this company)
    const policiesThisMonth = await this.prisma.policy.findMany({
      where: {
        companyId,
        createdAt: { gte: monthStart },
        status: { in: ['ACTIVE', 'ISSUED'] },
      },
      select: { premiumAmount: true },
    });
    const monthlyGwp = policiesThisMonth.reduce(
      (acc, p) => acc + Number(p.premiumAmount),
      0,
    );

    // 3. Outstanding Premium (Unpaid invoices for this company's policies)
    const companyPolicies = await this.prisma.policy.findMany({
      where: { companyId },
      select: { id: true },
    });
    const companyPolicyIds = companyPolicies.map((p) => p.id);

    const unpaidInvoices = await this.prisma.invoice.findMany({
      where: {
        status: 'UNPAID',
        ...(companyPolicyIds.length > 0
          ? { entityId: { in: companyPolicyIds } }
          : {}),
      },
      select: { totalAmount: true },
    });
    const outstandingPremium = unpaidInvoices.reduce(
      (acc, i) => acc + Number(i.totalAmount),
      0,
    );

    // 4. Commissions (scoped to company users)
    const accruedCommissions = await this.prisma.commission.findMany({
      where: {
        status: 'ACCRUED',
        user: { companyId },
      },
      select: { amount: true },
    });
    const totalCommissionAccrued = accruedCommissions.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    const paidCommissions = await this.prisma.commission.findMany({
      where: {
        status: 'PAID',
        user: { companyId },
      },
      select: { amount: true },
    });
    const totalCommissionPaid = paidCommissions.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    // Commissions today for real net margin calculation
    const commissionsToday = await this.prisma.commission.findMany({
      where: {
        createdAt: { gte: todayStart },
        user: { companyId },
      },
      select: { amount: true },
    });
    const todayCommissions = commissionsToday.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    // 5. Work queues
    const [
      pendingVerification,
      settlementsPending,
      commissionApproval,
      reconciliationQueueItems,
    ] = await Promise.all([
      this.prisma.backOfficeTask.count({
        where: {
          companyId,
          taskType: 'VERIFICATION',
          status: 'PENDING',
        },
      }),
      this.prisma.settlement.count({
        where: { status: 'PENDING' },
      }),
      this.prisma.commission.count({
        where: {
          status: 'ACCRUED',
          user: { companyId },
        },
      }),
      this.prisma.motorPaymentRecord.count({
        where: {
          status: 'UNDER_PROCESS',
          quotation: { companyId },
        },
      }),
    ]);

    // Ledger balance calculation from journal lines
    const ledgerAgg = await this.prisma.journalLine.aggregate({
      _sum: { debit: true, credit: true },
    });
    const ledgerBalance = Math.abs(
      Number(ledgerAgg._sum.debit || 0) - Number(ledgerAgg._sum.credit || 0),
    );

    return {
      todayCollections,
      monthlyGwp,
      outstandingPremium,
      totalCommissionAccrued,
      totalCommissionPaid,
      netProfitToday: Math.max(0, todayCollections - todayCommissions),
      payables: outstandingPremium,
      receivables: todayCollections,
      cashFlow: todayCollections - totalCommissionPaid,
      ledgerBalance: ledgerBalance > 0 ? ledgerBalance : todayCollections,
      myWorkQueue: {
        pendingVerification,
        settlementsPending,
        commissionApproval,
        reconciliationQueue: reconciliationQueueItems,
      },
    };
  }

  @Get('receipts/export')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Export premium receipts register as CSV' })
  async exportReceipts(
    @CurrentUser() actor: RequestUser,
    @Res() res: Response,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true },
    });
    const customerIds = companyCustomers.map((c) => c.id);

    const receipts = await this.prisma.receipt.findMany({
      where: customerIds.length > 0 ? { customerId: { in: customerIds } } : {},
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const sanitizeCsvCell = (value: string): string => {
      if (!value) return '';
      const dangerous = ['=', '+', '-', '@', '\t', '\r'];
      if (dangerous.some((char) => value.startsWith(char))) {
        return `'${value}`;
      }
      return value;
    };

    const csvHeaders =
      'Receipt Number,Customer ID,Amount,Payment Mode,Reference,Date\n';
    const csvRows = receipts
      .map(
        (r) =>
          `"${sanitizeCsvCell(r.receiptNum)}","${sanitizeCsvCell(r.customerId)}",${Number(r.amount)},"${sanitizeCsvCell(r.paymentMode)}","${sanitizeCsvCell(r.reference || '')}","${r.createdAt.toISOString()}"`,
      )
      .join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="receipts-register.csv"',
    );
    return res.send(csvHeaders + csvRows);
  }

  @Get('receipts')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List premium receipts' })
  async getReceipts(
    @CurrentUser() actor: RequestUser,
    @Query('status') status?: string,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true, firstName: true, lastName: true },
    });
    const customerMap = new Map(
      companyCustomers.map((c) => [
        c.id,
        `${c.firstName} ${c.lastName || ''}`.trim(),
      ]),
    );
    const customerIds = companyCustomers.map((c) => c.id);

    const where: any = {};
    if (customerIds.length > 0) {
      where.customerId = { in: customerIds };
    }
    if (status) {
      where.status = status;
    }

    const receipts = await this.prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNum,
      customerName: customerMap.get(r.customerId) || r.customerId,
      policyNumber: 'POL-' + r.id.substring(0, 8).toUpperCase(),
      amount: Number(r.amount),
      paymentMode: r.paymentMode,
      status: r.status,
      receivedBy: 'System',
      date: r.createdAt.toISOString(),
      txnRef: r.reference || '',
    }));
  }

  @Get('payments')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List outgoing payments / disbursements' })
  async getPayments(
    @CurrentUser() actor: RequestUser,
    @Query('type') type?: string,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const motorPayments = await this.prisma.motorPaymentRecord.findMany({
      where: {
        quotation: { companyId },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { quotation: true },
    });

    return motorPayments.map((p) => ({
      id: p.id,
      paymentNumber: p.referenceNumber || p.id.substring(0, 10).toUpperCase(),
      payee: p.quotation?.insurerName || 'Insurer Partner',
      type: 'INSURER_SETTLEMENT',
      amount: Number(p.amount),
      mode: p.paymentMethod,
      status: p.status === 'PAID' ? 'COMPLETED' : 'PENDING_APPROVAL',
      date: p.createdAt.toISOString(),
    }));
  }

  @Get('ledger')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List journal entries from general ledger' })
  async getLedgerEntries(
    @Query('search') search?: string,
    @Query('referenceType') referenceType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * l;

    const where: any = {};
    if (referenceType) {
      where.referenceType = referenceType;
    }
    if (search) {
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [entries, total] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where,
        skip,
        take: l,
        orderBy: { date: 'desc' },
        include: {
          lines: {
            include: {
              account: true,
            },
          },
        },
      }),
      this.prisma.journalEntry.count({ where }),
    ]);

    const items = entries.map((e) => ({
      id: e.id,
      entryNumber: e.entryNumber,
      date: e.date.toISOString(),
      description: e.description,
      referenceType: e.referenceType || 'GENERAL',
      referenceId: e.referenceId || '',
      status: e.status,
      lines: e.lines.map((ln) => ({
        accountName: ln.account?.name || 'Account ' + ln.accountId,
        debit: Number(ln.debit),
        credit: Number(ln.credit),
        accountType: ln.account?.type || 'ASSET',
      })),
    }));

    return { items, total };
  }

  @Post('ledger/journal')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Post new double-entry journal' })
  async postJournalEntry(@Body() data: CreateJournalEntryDto) {
    return this.ledgerService.postEntry(data);
  }

  @Get('commissions')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List broker / agent commissions' })
  async getCommissions(@CurrentUser() actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const commissions = await this.prisma.commission.findMany({
      where: {
        user: { companyId },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          include: {
            agentProfile: true,
          },
        },
      },
    });

    const policyIds = commissions.map((c) => c.policyId).filter(Boolean);
    const policies = await this.prisma.policy.findMany({
      where: { id: { in: policyIds } },
      select: {
        id: true,
        policyNumber: true,
        premiumAmount: true,
        contact: { select: { firstName: true, lastName: true } },
      },
    });
    const policyMap = new Map(policies.map((p) => [p.id, p]));

    return commissions.map((c) => {
      const pol = policyMap.get(c.policyId);
      const grossPremium = pol ? Number(pol.premiumAmount) : Number(c.amount);
      const commissionPercent =
        grossPremium > 0
          ? Math.round((Number(c.amount) / grossPremium) * 100)
          : 0;
      const customerName = pol?.contact
        ? `${pol.contact.firstName} ${pol.contact.lastName || ''}`.trim()
        : 'Customer';
      const policyNumber =
        pol?.policyNumber || 'POL-' + c.policyId.substring(0, 8).toUpperCase();

      return {
        id: c.id,
        policyNumber,
        customerName,
        agentName:
          `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.trim() ||
          'Agent',
        roleTier: c.roleTier,
        grossPremium,
        commissionPercent,
        commissionAmount: Number(c.amount),
        status: c.status === 'PAID' ? 'REALIZED' : 'ACCRUED',
        payoutStatus:
          c.status === 'PAID'
            ? 'PAID'
            : c.status === 'REALIZED'
              ? 'APPROVED'
              : 'PENDING_APPROVAL',
        createdAt: c.createdAt.toISOString(),
      };
    });
  }

  @Post('commissions/:id/approve')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Approve agent commission payout' })
  async approveCommission(
    @Param('id') id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const commission = await this.prisma.commission.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!commission || commission.user?.companyId !== companyId) {
      throw new NotFoundException('Commission record not found');
    }
    return this.prisma.commission.update({
      where: { id },
      data: { status: 'REALIZED' },
    });
  }

  @Get('settlements')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List insurer settlements' })
  async getSettlements() {
    const settlements = await this.prisma.settlement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return settlements.map((s) => {
      const total = Number(s.totalAmount);
      return {
        id: s.id,
        insurerName: 'Insurer Partner',
        period: s.date.toISOString().substring(0, 7),
        grossPremiumCollected: total,
        commissionRetained: Math.round(total * 0.1),
        netPayable: Math.round(total * 0.9),
        status: s.status === 'PROCESSED' ? 'SETTLED' : 'PENDING_SETTLEMENT',
        settledDate:
          s.status === 'PROCESSED' ? s.updatedAt.toISOString() : null,
      };
    });
  }

  @Get('incentives')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List sales performance incentives' })
  async getIncentives(@CurrentUser() actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const targets = await this.prisma.salesTarget.findMany({
      where: {
        user: { companyId },
      },
      take: 50,
      include: { user: true },
    });

    return targets.map((t) => ({
      id: t.id,
      employeeName:
        `${t.user?.firstName || ''} ${t.user?.lastName || ''}`.trim() ||
        'Employee',
      role: 'Sales Executive',
      type: 'QUARTERLY_TARGET',
      targetAmount: Number(t.targetGwp || 100000),
      achievedAmount: Number(t.achievedGwp || 0),
      incentiveAmount: Math.round(Number(t.achievedGwp || 0) * 0.05),
      status: 'PENDING',
    }));
  }

  @Get('reconciliation-queue')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get payment reconciliation queue' })
  async getReconciliationQueue(
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.reconciliationService.getReconciliationQueue({
      status,
      search,
      page,
      limit,
    });
  }

  @Post('reconciliation-queue/:id/reconcile')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Reconcile matched payment' })
  async reconcilePayment(
    @Param('id') id: string,
    @Body() dto: ReconcilePaymentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reconciliationService.reconcilePayment(id, actor.userId, dto);
  }

  @Post('reconciliation-queue/:id/discrepancy')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Flag discrepancy on payment' })
  async flagDiscrepancy(
    @Param('id') id: string,
    @Body() dto: DiscrepancyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reconciliationService.flagDiscrepancy(id, actor.userId, dto);
  }

  @Post('invoices/:id/pay')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Process payment allocation against an invoice' })
  async processInvoicePayment(
    @Param('id') invoiceId: string,
    @Body() dto: { amount: string; mode: string; reference?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    const companyId = actor.companyId || (actor as any).organizationId;
    if (invoice.entityType === 'POLICY' && companyId) {
      const policy = await this.prisma.policy.findUnique({
        where: { id: invoice.entityId },
        select: { companyId: true },
      });
      if (policy?.companyId && policy.companyId !== companyId) {
        throw new ForbiddenException(
          'Cross-organization access is strictly prohibited',
        );
      }
    }

    return this.paymentService.processPayment(
      invoiceId,
      dto.amount,
      dto.mode,
      dto.reference,
    );
  }
}
