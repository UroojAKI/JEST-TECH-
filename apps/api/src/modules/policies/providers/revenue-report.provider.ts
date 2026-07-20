import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportDataProvider, ReportParameters, ReportResult } from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class RevenueReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, ['REVENUE_REPORT', 'PREMIUM_COLLECTION', 'RENEWAL_REVENUE']);
  }

  supports(reportCode: string): boolean {
    return ['REVENUE_REPORT', 'PREMIUM_COLLECTION', 'RENEWAL_REVENUE'].includes(reportCode.toUpperCase());
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const reportCode = (params.parameters?.reportCode || '').toUpperCase();

    if (reportCode === 'REVENUE_REPORT') {
      return this.executeRevenueReport(params);
    }
    if (reportCode === 'RENEWAL_REVENUE') {
      return this.executeRenewalRevenue(params);
    }
    return this.executePremiumCollection(params);
  }

  private async executeRevenueReport(params: ReportParameters): Promise<ReportResult> {
    const period = params.parameters?.period || 'month';
    const now = new Date();
    const startDate = new Date();

    if (period === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      startDate.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(now.getMonth() - 1);
    } else if (period === 'quarter') {
      startDate.setMonth(now.getMonth() - 3);
    } else if (period === 'year') {
      startDate.setFullYear(now.getFullYear() - 1);
    }

    const payments = await this.prisma.policyPayment.findMany({
      where: {
        status: 'SUCCESS',
        paymentDate: { gte: startDate },
      },
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const transactionCount = payments.length;
    const averageTransaction = transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
      rows: [
        {
          period,
          totalRevenue,
          transactionCount,
          averageTransaction,
        },
      ],
    };
  }

  private async executePremiumCollection(params: ReportParameters): Promise<ReportResult> {
    const payments = await this.prisma.policyPayment.findMany({
      include: {
        policy: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    const rows = payments.map((p) => ({
      paymentId: p.id,
      policyNumber: p.policy.policyNumber,
      clientName: p.policy.contact ? `${p.policy.contact.firstName} ${p.policy.contact.lastName}` : '',
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      transactionId: p.transactionId,
      status: p.status,
      paymentDate: p.paymentDate,
    }));

    return { rows };
  }

  private async executeRenewalRevenue(params: ReportParameters): Promise<ReportResult> {
    const renewals = await this.prisma.policyRenewal.findMany({
      include: {
        policy: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = renewals.map((r) => ({
      renewalNumber: r.renewalNumber,
      policyNumber: r.policy.policyNumber,
      clientName: r.policy.contact ? `${r.policy.contact.firstName} ${r.policy.contact.lastName}` : '',
      premiumAmount: Number(r.premiumAmount),
      status: 'COMPLETED',
      renewalDate: r.createdAt,
    }));

    return { rows };
  }

  async *stream(params: ReportParameters) {
    const res = await this.execute(params);
    for (const row of res.rows) {
      yield row;
    }
  }
}
