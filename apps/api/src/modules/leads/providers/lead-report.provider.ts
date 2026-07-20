import { Injectable, OnModuleInit } from '@nestjs/common';
import { ReportDataProvider, ReportParameters, ReportResult } from '../../platform/reporting/interfaces/report-provider.interface';
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
    return ['LEAD_SUMMARY', 'LEAD_CONVERSION'].includes(reportCode.toUpperCase());
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const filters = params.parameters || {};
    const reportCode = filters.reportCode || '';
    if (reportCode.toUpperCase() === 'LEAD_CONVERSION') {
      return this.executeLeadConversion(params);
    }
    return this.executeLeadSummary(params);
  }

  private async executeLeadSummary(params: ReportParameters): Promise<ReportResult> {
    const leads = await this.prisma.lead.findMany({
      where: { deletedAt: null },
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = leads.map((l) => ({
      leadCode: l.leadCode,
      contactName: l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : '',
      source: l.source,
      assignedAgentName: l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : '',
      status: l.status,
      createdAt: l.createdAt,
      lastActivityAt: l.updatedAt,
      converted: l.status === 'CONVERTED' ? 'Yes' : 'No',
    }));

    return { rows };
  }

  private async executeLeadConversion(params: ReportParameters): Promise<ReportResult> {
    const leads = await this.prisma.lead.findMany({
      where: { deletedAt: null },
    });

    const totalLeads = leads.length;
    const qualifiedLeads = leads.filter((l) => l.status === 'QUALIFIED').length;
    const convertedLeads = leads.filter((l) => l.status === 'CONVERTED').length;
    const lostLeads = leads.filter((l) => l.status === 'LOST').length;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

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
    const reportCode = params.parameters?.reportCode || '';
    if (reportCode.toUpperCase() === 'LEAD_CONVERSION') {
      const res = await this.executeLeadConversion(params);
      for (const row of res.rows) {
        yield row;
      }
      return;
    }

    const leads = await this.prisma.lead.findMany({
      where: { deletedAt: null },
      include: {
        contact: true,
        assignedTo: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const l of leads) {
      yield {
        leadCode: l.leadCode,
        contactName: l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : '',
        source: l.source,
        assignedAgentName: l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : '',
        status: l.status,
        createdAt: l.createdAt,
        lastActivityAt: l.updatedAt,
        converted: l.status === 'CONVERTED' ? 'Yes' : 'No',
      };
    }
  }
}
