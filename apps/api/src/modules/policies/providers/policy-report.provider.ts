import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ReportDataProvider,
  ReportParameters,
  ReportResult,
} from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PolicyReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, [
      'ACTIVE_POLICIES',
      'EXPIRING_POLICIES',
      'POLICY_REGISTER',
    ]);
  }

  supports(reportCode: string): boolean {
    return ['ACTIVE_POLICIES', 'EXPIRING_POLICIES', 'POLICY_REGISTER'].includes(
      reportCode.toUpperCase(),
    );
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const reportCode = (params.parameters?.reportCode || '').toUpperCase();

    const companyId = params.companyId || params.parameters?.companyId;
    const whereClause: any = { deletedAt: null };

    if (companyId) {
      whereClause.companyId = companyId;
    }

    if (reportCode === 'ACTIVE_POLICIES') {
      whereClause.status = 'ACTIVE';
    } else if (reportCode === 'EXPIRING_POLICIES') {
      const days = Number(params.parameters?.days || 30);
      const now = new Date();
      const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      whereClause.expiryDate = {
        gte: now,
        lte: future,
      };
    }

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      if (reportCode === 'EXPIRING_POLICIES') {
        whereClause.expiryDate = { ...(whereClause.expiryDate || {}), ...dateFilter };
      } else {
        whereClause.createdAt = dateFilter;
      }
    }

    const policies = await this.prisma.policy.findMany({
      where: whereClause,
      include: {
        contact: true,
        quotation: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const rows = policies.map((p) => ({
      policyNumber: p.policyNumber,
      contactName: p.contact
        ? `${p.contact.firstName} ${p.contact.lastName}`
        : '',
      productName: p.quotation?.productType || '',
      insurerName: p.quotation?.insurerName || '',
      premiumAmount: Number(p.premiumAmount || 0),
      status: p.status,
      expiryDate: p.expiryDate,
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
