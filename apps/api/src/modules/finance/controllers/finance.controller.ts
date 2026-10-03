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
import { Decimal } from '@prisma/client/runtime/library';
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
import { sanitizeCsvCell } from '../../../common/utils/csv-sanitizer';
import { RecordInvoicePaymentDto } from '../dto/record-invoice-payment.dto';

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
    if (!companyId) {
      throw new ForbiddenException('Company context is required for finance');
    }

    // 1. Receipts today (scoped to customers of this company)
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true, contactId: true },
    });
    const companyCustomerIds = companyCustomers.flatMap((c) =>
      c.contactId ? [c.id, c.contactId] : [c.id],
    );

    const receiptsToday =
      companyCustomerIds.length > 0
        ? await this.prisma.receipt.findMany({
            where: {
              createdAt: { gte: todayStart },
              status: { not: 'BOUNCED' },
              customerId: { in: companyCustomerIds },
            },
            select: { amount: true },
          })
        : [];
    const todayCollections = receiptsToday.reduce(
      (acc, r) => acc + Number(r.amount),
      0,
    );

    // 2. Monthly GWP (Policies issued this month for this company)
    const policiesThisMonth = companyId
      ? await this.prisma.policy.findMany({
          where: {
            companyId,
            createdAt: { gte: monthStart },
            status: { in: ['ACTIVE', 'ISSUED'] },
          },
          select: { premiumAmount: true },
        })
      : [];
    const monthlyGwp = policiesThisMonth.reduce(
      (acc, p) => acc + Number(p.premiumAmount),
      0,
    );

    // 3. Outstanding Premium (Unpaid invoices for this company's policies)
    const companyPolicies = companyId
      ? await this.prisma.policy.findMany({
          where: { companyId, deletedAt: null },
          select: { id: true },
        })
      : [];
    const companyPolicyIds = companyPolicies.map((p) => p.id);

    const unpaidInvoices =
      companyPolicyIds.length > 0
        ? await this.prisma.invoice.findMany({
          where: {
              entityType: 'POLICY',
              status: { in: ['UNPAID', 'PARTIAL'] },
              entityId: { in: companyPolicyIds },
            },
            select: { totalAmount: true, allocations: { select: { amount: true } } },
          })
        : [];
    const outstandingPremium = unpaidInvoices.reduce(
      (acc, invoice) => {
        const paid = invoice.allocations.reduce(
          (sum, allocation) => sum.add(allocation.amount),
          new Decimal(0),
        );
        return acc + Number(invoice.totalAmount.sub(paid));
      },
      0,
    );

    // 4. Commissions (scoped to company users)
    const accruedCommissions = companyId
      ? await this.prisma.commission.findMany({
          where: {
            status: 'ACCRUED',
            user: { companyId },
          },
          select: { amount: true },
        })
      : [];
    const totalCommissionAccrued = accruedCommissions.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    const paidCommissions = companyId
      ? await this.prisma.commission.findMany({
          where: {
            status: 'PAID',
            user: { companyId },
          },
          select: { amount: true },
        })
      : [];
    const totalCommissionPaid = paidCommissions.reduce(
      (acc, c) => acc + Number(c.amount),
      0,
    );

    // 5. Work queues
    const companyClaims = companyId
      ? await this.prisma.claim.findMany({
          where: { companyId },
          select: { id: true },
        })
      : [];
    const companyClaimBatchNumbers = companyClaims.map((c) => `CLAIM-${c.id}`);

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
      companyClaimBatchNumbers.length > 0
        ? this.prisma.settlement.count({
            where: {
              status: 'PENDING',
              batchNumber: { in: companyClaimBatchNumbers },
            },
          })
        : 0,
      companyId
        ? this.prisma.commission.count({
            where: {
              status: 'ACCRUED',
              user: { companyId },
            },
          })
        : 0,
      this.prisma.motorPaymentRecord.count({
        where: {
          status: 'UNDER_PROCESS',
          quotation: { companyId },
        },
      }),
    ]);

    return {
      todayCollections,
      monthlyGwp,
      outstandingPremium,
      totalCommissionAccrued,
      totalCommissionPaid,
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
    if (!companyId) {
      throw new ForbiddenException('Company context is required');
    }
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true, contactId: true },
    });
    const customerIds = companyCustomers.flatMap((c) =>
      c.contactId ? [c.id, c.contactId] : [c.id],
    );

    const receipts =
      customerIds.length > 0
        ? await this.prisma.receipt.findMany({
            where: { customerId: { in: customerIds } },
            take: 1000,
            orderBy: { createdAt: 'desc' },
          })
        : [];

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
    if (!companyId) return [];
    const companyCustomers = await this.prisma.customer.findMany({
      where: { companyId },
      select: { id: true, contactId: true, firstName: true, lastName: true },
    });
    const customerMap = new Map<string, string>();
    for (const customer of companyCustomers) {
      const name = `${customer.firstName} ${customer.lastName || ''}`.trim();
      customerMap.set(customer.id, name);
      if (customer.contactId) customerMap.set(customer.contactId, name);
    }
    const customerIds = companyCustomers.flatMap((c) =>
      c.contactId ? [c.id, c.contactId] : [c.id],
    );

    if (customerIds.length === 0) {
      return [];
    }

    const where: any = { customerId: { in: customerIds } };
    if (status && status !== 'ALL') {
      where.status = status;
    }

    const receipts = await this.prisma.receipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        allocations: {
          include: {
            invoice: { select: { entityId: true, entityType: true } },
          },
        },
      },
    });

    const policyIds = [
      ...new Set(
        receipts.flatMap((receipt) =>
          receipt.allocations
            .filter((allocation) => allocation.invoice.entityType === 'POLICY')
            .map((allocation) => allocation.invoice.entityId),
        ),
      ),
    ];
    const policies = policyIds.length
      ? await this.prisma.policy.findMany({
          where: { companyId, id: { in: policyIds } },
          select: { id: true, policyNumber: true },
        })
      : [];
    const policyNumbers = new Map(policies.map((policy) => [policy.id, policy.policyNumber]));

    return receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNum,
      customerName: customerMap.get(r.customerId) || r.customerId,
      policyNumber:
        r.allocations
          .map((allocation) => policyNumbers.get(allocation.invoice.entityId))
          .find(Boolean) || 'Multiple policies',
      amount: Number(r.amount),
      paymentMode: r.paymentMode,
      txnRef: r.reference || '',
      receivedBy: 'Recorded payment',
      status: r.status,
      date: r.createdAt.toISOString(),
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
      payee: p.quotation?.insurerName || 'Unassigned Insurer',
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
    @CurrentUser() actor: RequestUser,
    @Query('search') search?: string,
    @Query('referenceType') referenceType?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    return this.ledgerService.getLedgerEntries(
      {
        search,
        referenceType,
        page,
        limit,
      },
      companyId,
    );
  }

  @Post('ledger/journal')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Post new double-entry journal' })
  async postJournalEntry(
    @Body() data: CreateJournalEntryDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    return this.ledgerService.postEntry(data, companyId);
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
      where: { id: { in: policyIds }, companyId, deletedAt: null },
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
  async getSettlements(@CurrentUser() actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    const companyClaims = companyId
      ? await this.prisma.claim.findMany({
          where: { companyId },
          select: {
            id: true,
            policy: {
              select: {
                quotation: {
                  select: {
                    insurerName: true,
                  },
                },
              },
            },
          },
        })
      : [];
    const claimInsurerMap = new Map(
      companyClaims.map((c) => [
        `CLAIM-${c.id}`,
        c.policy?.quotation?.insurerName || null,
      ]),
    );
    const companyClaimBatchNumbers = companyClaims.map((c) => `CLAIM-${c.id}`);

    const settlements = await this.prisma.settlement.findMany({
      where:
        companyClaimBatchNumbers.length > 0
          ? { batchNumber: { in: companyClaimBatchNumbers } }
          : { id: '__no_tenant_settlements__' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return settlements.map((s) => {
      const total = Number(s.totalAmount);
      const insurerName = claimInsurerMap.get(s.batchNumber) || null;
      return {
        id: s.id,
        insurerName,
        period: s.date.toISOString().substring(0, 7),
        grossPremiumCollected: total,
        commissionRetained: 0,
        netPayable: total,
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
    @CurrentUser() actor: RequestUser,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    return this.reconciliationService.getReconciliationQueue({
      status,
      search,
      page,
      limit,
      companyId,
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
    return this.reconciliationService.reconcilePayment(id, actor, dto);
  }

  @Post('reconciliation-queue/:id/discrepancy')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Flag discrepancy on payment' })
  async flagDiscrepancy(
    @Param('id') id: string,
    @Body() dto: DiscrepancyDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.reconciliationService.flagDiscrepancy(id, actor, dto);
  }

  @Get('invoices/outstanding')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List this company\'s payable policy invoices' })
  async getOutstandingInvoices(@CurrentUser() actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) return [];

    const policies = await this.prisma.policy.findMany({
      where: {
        companyId,
        deletedAt: null,
        customerId: { not: null },
        customer: { is: { companyId, deletedAt: null } },
      },
      select: {
        id: true,
        policyNumber: true,
        customer: { select: { firstName: true, lastName: true } },
      },
    });
    if (!policies.length) return [];

    const policyById = new Map(policies.map((policy) => [policy.id, policy]));
    const invoices = await this.prisma.invoice.findMany({
      where: {
        entityType: 'POLICY',
        entityId: { in: policies.map((policy) => policy.id) },
        status: { in: ['UNPAID', 'PARTIAL'] },
      },
      include: { allocations: true },
      orderBy: { dueDate: 'asc' },
    });

    return invoices.flatMap((invoice) => {
      const policy = policyById.get(invoice.entityId);
      if (!policy?.customer) return [];

      const paid = invoice.allocations.reduce(
        (total, allocation) => total.add(allocation.amount),
        invoice.totalAmount.minus(invoice.totalAmount),
      );
      const outstanding = invoice.totalAmount.minus(paid);
      if (outstanding.lte(0)) return [];

      return [{
        id: invoice.id,
        invoiceNumber: invoice.invoiceNum,
        policyNumber: policy.policyNumber,
        customerName: [policy.customer.firstName, policy.customer.lastName]
          .filter(Boolean)
          .join(' '),
        totalAmount: invoice.totalAmount.toString(),
        paidAmount: paid.toString(),
        outstandingAmount: outstanding.toString(),
        dueDate: invoice.dueDate,
      }];
    });
  }

  @Post('invoices/:id/pay')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Process payment allocation against an invoice' })
  async processInvoicePayment(
    @Param('id') invoiceId: string,
    @Body() dto: RecordInvoicePaymentDto,
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for payment');
    }

    return this.paymentService.processPayment(
      invoiceId,
      dto.amount,
      dto.mode,
      companyId,
      dto.reference,
    );
  }
}
