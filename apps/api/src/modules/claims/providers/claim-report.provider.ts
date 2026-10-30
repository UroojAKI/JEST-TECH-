import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ReportDataProvider,
  ReportParameters,
  ReportResult,
} from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class ClaimReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, [
      'CLAIMS_REGISTER',
      'CLAIMS_PENDING',
      'LOSS_RATIO',
    ]);
  }

  supports(reportCode: string): boolean {
    return ['CLAIMS_REGISTER', 'CLAIMS_PENDING', 'LOSS_RATIO'].includes(
      reportCode.toUpperCase(),
    );
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const reportCode = (params.parameters?.reportCode || '').toUpperCase();

    if (reportCode === 'LOSS_RATIO') {
      return this.executeLossRatio(params);
    }

    const companyId = params.companyId || params.parameters?.companyId;
    const whereClause: any = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    if (reportCode === 'CLAIMS_PENDING') {
      whereClause.status = {
        in: [
          'REPORTED',
          'REGISTERED',
          'SURVEYOR_ASSIGNED',
          'UNDER_ASSESSMENT',
          'PAYMENT_PENDING',
        ],
      };
    }

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const claims = await this.prisma.claim.findMany({
      where: whereClause,
      include: {
        policy: true,
        contact: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const rows = claims.map((c) => ({
      claimNumber: c.claimNumber,
      policyNumber: c.policy?.policyNumber || '',
      contactName: c.contact
        ? `${c.contact.firstName} ${c.contact.lastName}`
        : '',
      status: c.status,
      claimAmount: Number(c.claimAmount || 0),
      surveyorName: c.surveyorName || '',
      settlementAmount: Number(c.approvedAmount || 0),
    }));

    return { rows };
  }

  private async executeLossRatio(
    params: ReportParameters,
  ): Promise<ReportResult> {
    const companyId = params.companyId || params.parameters?.companyId;
    const claimWhere: any = {
      status: { in: ['SETTLED', 'APPROVED'] },
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };
    const paymentWhere: any = {
      status: 'SUCCESS',
      ...(companyId ? { policy: { companyId } } : {}),
    };

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      claimWhere.createdAt = {};
      if (startDate) claimWhere.createdAt.gte = new Date(startDate);
      if (endDate) claimWhere.createdAt.lte = new Date(endDate);

      paymentWhere.paymentDate = {};
      if (startDate) paymentWhere.paymentDate.gte = new Date(startDate);
      if (endDate) paymentWhere.paymentDate.lte = new Date(endDate);
    }

    const claims = await this.prisma.claim.findMany({
      where: claimWhere,
    });
    const claimsPaid = claims.reduce(
      (sum, c) => sum + Number(c.approvedAmount || 0),
      0,
    );

    const payments = await this.prisma.policyPayment.findMany({
      where: paymentWhere,
    });
    const premiumCollected = payments.reduce(
      (sum, p) => sum + Number(p.amount || 0),
      0,
    );

    const lossRatio =
      premiumCollected > 0 ? (claimsPaid / premiumCollected) * 100 : 0;

    return {
      rows: [
        {
          claimsPaid,
          premiumCollected,
          lossRatio: `${lossRatio.toFixed(2)}%`,
        },
      ],
    };
  }

  async *stream(params: ReportParameters) {
    const res = await this.execute(params);
    for (const row of res.rows) {
      yield row;
    }
  }
}
