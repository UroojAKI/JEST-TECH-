import { Injectable, NotFoundException } from '@nestjs/common';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { ReportLibraryService } from './report-library.service';

export interface ReportFilter {
  from?: string;
  to?: string;
  status?: string;
  agentId?: string;
  type?: string;
}

export interface ReportResult {
  templateId: string;
  name: string;
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  generatedAt: Date;
  filters: ReportFilter;
}

@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly warehouse: WarehouseService,
    private readonly library: ReportLibraryService,
  ) {}

  async runBuiltInReport(templateId: string, filters: ReportFilter): Promise<ReportResult> {
    const template = this.library.getById(templateId);
    if (!template) throw new NotFoundException(`Report template '${templateId}' not found`);

    const parsedFilters = {
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      status: filters.status,
      agentId: filters.agentId,
      type: filters.type,
    };

    let rows: Record<string, any>[] = [];

    switch (template.dataSource) {
      case 'contacts':
        rows = await this.warehouse.getReportingContacts(parsedFilters);
        break;
      case 'leads':
        rows = await this.warehouse.getReportingLeads(parsedFilters);
        break;
      case 'policies':
        rows = await this.warehouse.getReportingPolicies(parsedFilters);
        // Filter missed renewals specially
        if (templateId === 'missed-renewals') {
          rows = rows.filter((r) => r.status !== 'ACTIVE' && r.expiryDate && new Date(r.expiryDate) < new Date());
        }
        break;
      case 'claims':
        rows = await this.warehouse.getReportingClaims(parsedFilters);
        // Status sub-filters for claims reports
        if (templateId === 'open-claims') rows = rows.filter((r) => !['SETTLED', 'CLOSED', 'REJECTED'].includes(r.status));
        if (templateId === 'settled-claims') rows = rows.filter((r) => r.status === 'SETTLED' || r.status === 'CLOSED');
        if (templateId === 'rejected-claims') rows = rows.filter((r) => r.status === 'REJECTED');
        if (templateId === 'claim-aging') rows = rows.sort((a, b) => new Date(a.reportedAt).getTime() - new Date(b.reportedAt).getTime());
        break;
      case 'renewals':
        rows = await this.warehouse.getReportingRenewals();
        if (templateId === 'renewal-30') rows = rows.filter((r) => r.daysToExpiry <= 30);
        if (templateId === 'renewal-20') rows = rows.filter((r) => r.daysToExpiry <= 20);
        break;
      case 'revenue':
        rows = await this.warehouse.getReportingRevenue(parsedFilters);
        if (templateId === 'outstanding-premium') rows = rows.filter((r) => r.paymentStatus !== 'SUCCESS');
        break;
      default:
        rows = [];
    }

    // Project only requested columns
    const projectedRows = rows.map((row) => {
      const projected: Record<string, any> = {};
      for (const col of template.defaultColumns) {
        projected[col] = row[col] ?? null;
      }
      return projected;
    });

    return {
      templateId,
      name: template.name,
      columns: template.defaultColumns,
      rows: projectedRows,
      rowCount: projectedRows.length,
      generatedAt: new Date(),
      filters,
    };
  }

  async runSavedReport(
    reportConfig: { dataSource: string; columns: any[]; filters: any[]; sortBy?: string; sortDir?: string },
    inputFilters: ReportFilter,
  ): Promise<ReportResult> {
    const parsedFilters = {
      from: inputFilters.from ? new Date(inputFilters.from) : undefined,
      to: inputFilters.to ? new Date(inputFilters.to) : undefined,
      status: inputFilters.status,
      agentId: inputFilters.agentId,
      type: inputFilters.type,
    };

    let rows: Record<string, any>[] = [];
    switch (reportConfig.dataSource) {
      case 'contacts': rows = await this.warehouse.getReportingContacts(parsedFilters); break;
      case 'leads':    rows = await this.warehouse.getReportingLeads(parsedFilters); break;
      case 'policies': rows = await this.warehouse.getReportingPolicies(parsedFilters); break;
      case 'claims':   rows = await this.warehouse.getReportingClaims(parsedFilters); break;
      case 'renewals': rows = await this.warehouse.getReportingRenewals(); break;
      case 'revenue':  rows = await this.warehouse.getReportingRevenue(parsedFilters); break;
      default:         rows = [];
    }

    // Apply column projection
    const columnKeys = (reportConfig.columns as any[]).map((c: any) => (typeof c === 'string' ? c : c.key));

    // Apply sort
    if (reportConfig.sortBy) {
      const dir = reportConfig.sortDir === 'desc' ? -1 : 1;
      rows.sort((a, b) => {
        if (a[reportConfig.sortBy!] < b[reportConfig.sortBy!]) return -1 * dir;
        if (a[reportConfig.sortBy!] > b[reportConfig.sortBy!]) return 1 * dir;
        return 0;
      });
    }

    const projectedRows = rows.map((row) => {
      const projected: Record<string, any> = {};
      for (const col of columnKeys) projected[col] = row[col] ?? null;
      return projected;
    });

    return {
      templateId: 'custom',
      name: 'Custom Report',
      columns: columnKeys,
      rows: projectedRows,
      rowCount: projectedRows.length,
      generatedAt: new Date(),
      filters: inputFilters,
    };
  }
}
