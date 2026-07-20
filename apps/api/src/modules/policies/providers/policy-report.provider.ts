import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportDataProvider, ReportParameters, ReportResult } from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class PolicyReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, ['ACTIVE_POLICIES', 'EXPIRING_POLICIES', 'POLICY_REGISTER']);
  }

  supports(reportCode: string): boolean {
    return ['ACTIVE_POLICIES', 'EXPIRING_POLICIES', 'POLICY_REGISTER'].includes(reportCode.toUpperCase());
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const reportCode = (params.parameters?.reportCode || '').toUpperCase();
    
    let whereClause: any = { deletedAt: null };
    
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

    const policies = await this.prisma.policy.findMany({
      where: whereClause,
      include: {
        contact: true,
        quotation: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = policies.map((p) => ({
      policyNumber: p.policyNumber,
      contactName: p.contact ? `${p.contact.firstName} ${p.contact.lastName}` : '',
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
