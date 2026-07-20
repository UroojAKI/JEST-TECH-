import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ReportFilterOperator } from '@prisma/client';
import { WarehouseService } from '../../../warehouse/services/warehouse.service';
import { ReportWithRelations } from '../repositories/reports.repository';
import { ReportDataProviderRegistry } from './report-data-provider-registry.service';

@Injectable()
export class ReportBuilderService {
  constructor(
    private readonly warehouse: WarehouseService,
    private readonly registry: ReportDataProviderRegistry,
  ) {}

  async fetchRawData(
    module: string,
    filters: any,
  ): Promise<Record<string, any>[]> {
    // Parse standard parameters from incoming filters
    const parsedFilters = {
      from: filters.from ? new Date(filters.from) : undefined,
      to: filters.to ? new Date(filters.to) : undefined,
      status: filters.status,
      agentId: filters.agentId,
      type: filters.type,
    };

    switch (module.toUpperCase()) {
      case 'CONTACTS':
        return this.warehouse.getReportingContacts(parsedFilters);
      case 'LEADS':
        return this.warehouse.getReportingLeads(parsedFilters);
      case 'POLICIES':
        return this.warehouse.getReportingPolicies(parsedFilters);
      case 'CLAIMS':
        return this.warehouse.getReportingClaims(parsedFilters);
      case 'REPORTS':
      case 'RENEWALS':
        return this.warehouse.getReportingRenewals();
      case 'QUOTATIONS':
      case 'REVENUE':
        return this.warehouse.getReportingRevenue(parsedFilters);
      default:
        return [];
    }
  }

  async buildReportData(
    report: ReportWithRelations,
    inputParams: Record<string, any> = {},
    options: { limit?: number; search?: string } = {},
  ): Promise<{
    rows: Record<string, any>[];
    columns: { field: string; label: string; type: string }[];
  }> {
    let rows: Record<string, any>[] = [];
    const provider = this.registry.getProvider(report.code);

    if (provider) {
      const filtersList = report.filters.map((f) => ({
        field: f.field,
        operator: f.operator,
        value:
          inputParams[f.field] !== undefined
            ? inputParams[f.field]
            : f.defaultValue,
      }));

      const res = await provider.execute({
        parameters: inputParams,
        filters: filtersList,
        search: options.search,
        limit: options.limit,
      });
      rows = res.rows;
    } else {
      rows = await this.fetchRawData(report.module, inputParams);
    }

    // Apply Report Configured Filters
    for (const filterConfig of report.filters) {
      const field = filterConfig.field;
      const operator = filterConfig.operator;
      const req = filterConfig.required;
      const defVal = filterConfig.defaultValue;

      const paramValue =
        inputParams[field] !== undefined ? inputParams[field] : defVal;

      if (paramValue === undefined || paramValue === null) {
        if (req) {
          throw new BadRequestException(
            `Filter parameter '${field}' is required for this report.`,
          );
        }
        continue; // Skip filtering if not provided
      }

      // Filter rows
      rows = rows.filter((row) => {
        const value = this.getFieldValue(row, field);
        return this.evaluateOperator(value, operator, paramValue);
      });
    }

    // Apply Global Search across all visible columns
    if (options.search) {
      const query = options.search.toLowerCase();
      const visibleFields = report.columns
        .filter((c) => c.visible)
        .map((c) => c.field);
      rows = rows.filter((row) => {
        return visibleFields.some((field) => {
          const val = this.getFieldValue(row, field);
          return (
            val !== null &&
            val !== undefined &&
            String(val).toLowerCase().includes(query)
          );
        });
      });
    }

    // Project columns
    const columns = report.columns.map((c) => ({
      field: c.field,
      label: c.label,
      type: c.type,
    }));

    const projectedRows = rows.map((row) => {
      const projected: Record<string, any> = {};
      for (const col of report.columns) {
        projected[col.field] = this.getFieldValue(row, col.field);
      }
      return projected;
    });

    // Apply Limit (useful for preview mode)
    const limitedRows = options.limit
      ? projectedRows.slice(0, options.limit)
      : projectedRows;

    return {
      rows: limitedRows,
      columns,
    };
  }

  private getFieldValue(obj: any, path: string): any {
    if (!obj) return null;
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
      if (current === null || current === undefined) return null;
      current = current[part];
    }
    return current;
  }

  private evaluateOperator(
    rowValue: any,
    operator: ReportFilterOperator,
    paramValue: any,
  ): boolean {
    if (operator === ReportFilterOperator.NULL) {
      return rowValue === null || rowValue === undefined;
    }
    if (operator === ReportFilterOperator.NOT_NULL) {
      return rowValue !== null && rowValue !== undefined;
    }

    if (rowValue === null || rowValue === undefined) return false;

    switch (operator) {
      case ReportFilterOperator.EQUALS:
        return (
          String(rowValue).toLowerCase() === String(paramValue).toLowerCase()
        );

      case ReportFilterOperator.CONTAINS:
        return String(rowValue)
          .toLowerCase()
          .includes(String(paramValue).toLowerCase());

      case ReportFilterOperator.STARTS_WITH:
        return String(rowValue)
          .toLowerCase()
          .startsWith(String(paramValue).toLowerCase());

      case ReportFilterOperator.ENDS_WITH:
        return String(rowValue)
          .toLowerCase()
          .endsWith(String(paramValue).toLowerCase());

      case ReportFilterOperator.GREATER_THAN:
        return Number(rowValue) > Number(paramValue);

      case ReportFilterOperator.LESS_THAN:
        return Number(rowValue) < Number(paramValue);

      case ReportFilterOperator.BETWEEN: {
        let range = paramValue;
        if (typeof paramValue === 'string') {
          range = paramValue.split(',').map((s) => s.trim());
        }
        if (Array.isArray(range) && range.length === 2) {
          const val =
            typeof rowValue === 'object' && rowValue instanceof Date
              ? rowValue.getTime()
              : new Date(rowValue).getTime();
          const min = new Date(range[0]).getTime();
          const max = new Date(range[1]).getTime();
          return val >= min && val <= max;
        }
        return false;
      }

      case ReportFilterOperator.IN: {
        let inList = paramValue;
        if (typeof paramValue === 'string') {
          inList = paramValue.split(',').map((s) => s.trim());
        }
        if (Array.isArray(inList)) {
          return inList
            .map((v) => String(v).toLowerCase())
            .includes(String(rowValue).toLowerCase());
        }
        return false;
      }

      case ReportFilterOperator.NOT_IN: {
        let notInList = paramValue;
        if (typeof paramValue === 'string') {
          notInList = paramValue.split(',').map((s) => s.trim());
        }
        if (Array.isArray(notInList)) {
          return !notInList
            .map((v) => String(v).toLowerCase())
            .includes(String(rowValue).toLowerCase());
        }
        return true;
      }

      default:
        return false;
    }
  }

  aggregateData(
    rows: Record<string, any>[],
    columns: {
      field: string;
      type: string;
      aggregation?: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
    }[],
    groupByField?: string,
  ): any {
    if (!groupByField) {
      const summary: Record<string, any> = {};
      for (const col of columns) {
        if (!col.aggregation) continue;
        const vals = rows
          .map((r) => Number(r[col.field]))
          .filter((v) => !isNaN(v));
        switch (col.aggregation) {
          case 'SUM':
            summary[col.field] = vals.reduce((a, b) => a + b, 0);
            break;
          case 'AVG':
            summary[col.field] =
              vals.length > 0
                ? vals.reduce((a, b) => a + b, 0) / vals.length
                : 0;
            break;
          case 'COUNT':
            summary[col.field] = rows.length;
            break;
          case 'MIN':
            summary[col.field] = vals.length > 0 ? Math.min(...vals) : 0;
            break;
          case 'MAX':
            summary[col.field] = vals.length > 0 ? Math.max(...vals) : 0;
            break;
        }
      }
      return summary;
    }

    const groups: Record<string, Record<string, any>[]> = {};
    for (const row of rows) {
      const key = String(row[groupByField] || 'Unknown');
      if (!groups[key]) groups[key] = [];
      groups[key].push(row);
    }

    const result = Object.entries(groups).map(([key, groupRows]) => {
      const groupRes: Record<string, any> = { [groupByField]: key };
      for (const col of columns) {
        if (col.field === groupByField) continue;
        const vals = groupRows
          .map((r) => Number(r[col.field]))
          .filter((v) => !isNaN(v));
        if (col.aggregation) {
          switch (col.aggregation) {
            case 'SUM':
              groupRes[col.field] = vals.reduce((a, b) => a + b, 0);
              break;
            case 'AVG':
              groupRes[col.field] =
                vals.length > 0
                  ? vals.reduce((a, b) => a + b, 0) / vals.length
                  : 0;
              break;
            case 'COUNT':
              groupRes[col.field] = groupRows.length;
              break;
            case 'MIN':
              groupRes[col.field] = vals.length > 0 ? Math.min(...vals) : 0;
              break;
            case 'MAX':
              groupRes[col.field] = vals.length > 0 ? Math.max(...vals) : 0;
              break;
          }
        } else {
          groupRes[col.field] = groupRows.length;
        }
      }
      return groupRes;
    });

    return result;
  }
}
