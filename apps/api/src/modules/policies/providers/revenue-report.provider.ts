import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ReportDataProvider,
  ReportParameters,
  ReportResult,
} from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class RevenueReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, [
      'REVENUE_REPORT',
      'PREMIUM_COLLECTION',
      'RENEWAL_REVENUE',
    ]);
  }

  supports(reportCode: string): boolean {
    return ['REVENUE_REPORT', 'PREMIUM_COLLECTION', 'RENEWAL_REVENUE'].includes(
      reportCode.toUpperCase(),
    );
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

  private async executeRevenueReport(
    params: ReportParameters,
  ): Promise<ReportResult> {
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

    const companyId = params.companyId || params.parameters?.companyId;
    const paymentDateFilter: any = {};
    const paramStartDate =
      params.parameters?.startDate || params.parameters?.from;
    const paramEndDate = params.parameters?.endDate || params.parameters?.to;

    if (paramStartDate || paramEndDate) {
      if (paramStartDate) paymentDateFilter.gte = new Date(paramStartDate);
      if (paramEndDate) paymentDateFilter.lte = new Date(paramEndDate);
    } else {
      paymentDateFilter.gte = startDate;
    }

    const payments = await this.prisma.policyPayment.findMany({
      where: {
        status: 'SUCCESS',
        paymentDate: paymentDateFilter,
        ...(companyId ? { policy: { companyId } } : {}),
      },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);
    const transactionCount = payments.length;
    const averageTransaction =
      transactionCount > 0 ? totalRevenue / transactionCount : 0;

    return {
      rows: [
        {
          period:
            paramStartDate && paramEndDate
              ? `${paramStartDate} to ${paramEndDate}`
              : period,
          totalRevenue,
          transactionCount,
          averageTransaction,
        },
      ],
    };
  }

  private async executePremiumCollection(
    params: ReportParameters,
  ): Promise<ReportResult> {
    const companyId = params.companyId || params.parameters?.companyId;
    const where: any = {};
    if (companyId) {
      where.policy = { companyId };
    }
    where.status = params.parameters?.status || 'SUCCESS';

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    const payments = await this.prisma.policyPayment.findMany({
      where,
      include: {
        policy: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const rows = payments.map((p) => ({
      paymentId: p.id,
      policyNumber: p.policy?.policyNumber || '',
      clientName: p.policy?.contact
        ? `${p.policy.contact.firstName} ${p.policy.contact.lastName}`
        : '',
      amount: Number(p.amount),
      paymentMethod: p.paymentMethod,
      transactionId: p.transactionId,
      status: p.status,
      paymentDate: p.paymentDate,
    }));

    return { rows };
  }

  private async executeRenewalRevenue(
    params: ReportParameters,
  ): Promise<ReportResult> {
    const companyId = params.companyId || params.parameters?.companyId;
    const where: any = {};
    if (companyId) {
      where.policy = { companyId };
    }

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }
    if (params.parameters?.status) {
      where.policy = {
        ...(where.policy || {}),
        status: params.parameters.status,
      };
    }

    const renewals = await this.prisma.policyRenewal.findMany({
      where,
      include: {
        policy: {
          include: {
            contact: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const rows = renewals.map((r) => ({
      renewalNumber: r.renewalNumber,
      policyNumber: r.policy?.policyNumber || '',
      clientName: r.policy?.contact
        ? `${r.policy.contact.firstName} ${r.policy.contact.lastName}`
        : '',
      premiumAmount: Number(r.premiumAmount),
      status: (r as any).status || r.policy?.status || 'COMPLETED',
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
