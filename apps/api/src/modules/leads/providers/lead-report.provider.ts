import { Injectable, OnModuleInit, ForbiddenException } from '@nestjs/common';
import {
  ReportDataProvider,
  ReportParameters,
  ReportResult,
} from '../../platform/reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../platform/reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class LeadReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, ['LEAD_SUMMARY', 'LEAD_CONVERSION']);
  }

  supports(reportCode: string): boolean {
    return ['LEAD_SUMMARY', 'LEAD_CONVERSION'].includes(
      reportCode.toUpperCase(),
    );
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const companyId = params.companyId;
    if (!companyId) {
      throw new ForbiddenException(
        'Tenant company context is required for lead reporting',
      );
    }

    const filters = params.parameters || {};
    const reportCode = filters.reportCode || '';
    if (reportCode.toUpperCase() === 'LEAD_CONVERSION') {
      return this.executeLeadConversion(params, companyId);
    }
    return this.executeLeadSummary(params, companyId);
  }

  private buildWhere(params: ReportParameters, companyId: string) {
    const where: any = {
      deletedAt: null,
      companyId,
    };

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (params.parameters?.status) {
      where.status = params.parameters.status;
    }

    return where;
  }

  private async executeLeadSummary(
    params: ReportParameters,
    companyId: string,
  ): Promise<ReportResult> {
    const where = this.buildWhere(params, companyId);

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    const rows = leads.map((l) => ({
      leadCode: l.leadCode,
      contactName: l.contact
        ? `${l.contact.firstName} ${l.contact.lastName}`
        : '',
      source: l.source,
      assignedAgentName: l.assignedTo
        ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}`
        : '',
      status: l.status,
      createdAt: l.createdAt,
      lastActivityAt: l.updatedAt,
      converted: l.status === 'CONVERTED' ? 'Yes' : 'No',
    }));

    return { rows };
  }

  private async executeLeadConversion(
    params: ReportParameters,
    companyId: string,
  ): Promise<ReportResult> {
    const where = this.buildWhere(params, companyId);

    const leads = await this.prisma.lead.findMany({
      where,
    });

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l) => l.status === 'QUALIFIED').length;
    const convertedLeads = leads.filter((l) => l.status === 'CONVERTED').length;
    const lostLeads = leads.filter((l) => l.status === 'LOST').length;
    const conversionRate =
      totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      rows: [
        {
          totalLeads,
          qualifiedLeads,
          convertedLeads,
          lostLeads,
          conversionRate: `${conversionRate.toFixed(2)}%`,
        },
      ],
    };
  }

  async *stream(params: ReportParameters) {
    const companyId = params.companyId;
    if (!companyId) {
      throw new ForbiddenException(
        'Tenant company context is required for lead reporting',
      );
    }

    const reportCode = params.parameters?.reportCode || '';
    if (reportCode.toUpperCase() === 'LEAD_CONVERSION') {
      const res = await this.executeLeadConversion(params, companyId);
      for (const row of res.rows) {
        yield row;
      }
      return;
    }

    const where = this.buildWhere(params, companyId);

    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
      ...(params.limit ? { take: params.limit } : {}),
    });

    for (const l of leads) {
      yield {
        leadCode: l.leadCode,
        contactName: l.contact
          ? `${l.contact.firstName} ${l.contact.lastName}`
          : '',
        source: l.source,
        assignedAgentName: l.assignedTo
          ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}`
          : '',
        status: l.status,
        createdAt: l.createdAt,
        lastActivityAt: l.updatedAt,
        converted: l.status === 'CONVERTED' ? 'Yes' : 'No',
      };
    }
  }
}
