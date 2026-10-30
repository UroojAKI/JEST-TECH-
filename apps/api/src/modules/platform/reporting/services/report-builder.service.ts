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
    companyId?: string,
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
        return this.warehouse.getReportingContacts(companyId, parsedFilters);
      case 'LEADS':
        return this.warehouse.getReportingLeads(companyId, parsedFilters);
      case 'POLICIES':
        return this.warehouse.getReportingPolicies(companyId, parsedFilters);
      case 'CLAIMS':
        return this.warehouse.getReportingClaims(companyId, parsedFilters);
      case 'REPORTS':
      case 'RENEWALS':
        return this.warehouse.getReportingRenewals(companyId);
      case 'QUOTATIONS':
      case 'REVENUE':
        return this.warehouse.getReportingRevenue(companyId, parsedFilters);
      default:
        throw new BadRequestException(`Unsupported reporting module: ${module}`);
    }
  }

  async buildReportData(
    report: ReportWithRelations,
    inputParams: Record<string, any> = {},
    options: {
      limit?: number;
      page?: number;
      search?: string;
      groupBy?: string[];
      aggregations?: {
        column: string;
        func: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX';
      }[];
    } = {},
    companyId?: string,
  ): Promise<{
    rows: Record<string, any>[];
    columns: { field: string; label: string; type: string }[];
    summary?: Record<string, number>;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    if (inputParams.dateRange && !inputParams.from && !inputParams.startDate) {
      const now = new Date();
      let fromDate: Date | undefined;
      switch (inputParams.dateRange) {
        case 'TODAY':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'LAST_7_DAYS':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'LAST_30_DAYS':
          fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'THIS_QUARTER':
          fromDate = new Date(
            now.getFullYear(),
            Math.floor(now.getMonth() / 3) * 3,
            1,
          );
          break;
        case 'YTD': {
          const fyYear =
            now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          fromDate = new Date(fyYear, 3, 1);
          break;
        }
      }
      if (fromDate) {
        inputParams.from = fromDate.toISOString();
        inputParams.startDate = fromDate.toISOString();
        inputParams.endDate = now.toISOString();
        inputParams.to = now.toISOString();
      }
    }

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
        companyId,
        parameters: { ...inputParams },
        filters: filtersList,
        search: options.search,
        limit: options.limit,
      });
      rows = res.rows;
    } else {
      rows = await this.fetchRawData(report.module, inputParams, companyId);
    }

    // Bound maximum dataset size to prevent out-of-memory denial of service
    const MAX_REPORT_ROWS = 10000;
    if (rows.length > MAX_REPORT_ROWS) {
      rows = rows.slice(0, MAX_REPORT_ROWS);
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
    let columns = report.columns.map((c) => ({
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

    let finalRows = projectedRows;
    let summary: Record<string, number> | undefined;

    const groupByField =
      options.groupBy && options.groupBy.length > 0
        ? options.groupBy[0]
        : undefined;

    if (groupByField) {
      const allowedFields = new Set([
        ...report.columns.map((c) => c.field),
        'insurer',
        'branch',
        'agent',
        'policyType',
        'month',
        'status',
        'source',
        'state',
        'city',
      ]);
      if (!allowedFields.has(groupByField)) {
        throw new BadRequestException(
          `Invalid groupBy dimension: ${groupByField}. Allowed dimensions: ${Array.from(allowedFields).join(', ')}`,
        );
      }

      if (options.aggregations && options.aggregations.length > 0) {
        const allowedAggCols = new Set([
          ...report.columns.map((c) => c.field),
          '*',
          groupByField,
        ]);
        for (const agg of options.aggregations) {
          if (!agg.column) {
            throw new BadRequestException('Aggregation column must be specified');
          }
          if (!allowedAggCols.has(agg.column)) {
            throw new BadRequestException(
              `Invalid aggregation column: ${agg.column}. Column does not exist in report definition.`,
            );
          }
          if (!['SUM', 'AVG', 'COUNT', 'MIN', 'MAX'].includes(agg.func)) {
            throw new BadRequestException(
              `Invalid aggregation function: ${agg.func}. Allowed functions: SUM, AVG, COUNT, MIN, MAX`,
            );
          }
        }
      }

      const aggColumns = report.columns.map((c) => ({
        field: c.field,
        type: c.type,
        aggregation: (options.aggregations?.find((a) => a.column === c.field)
          ?.func ||
          (c.type === 'NUMBER' || c.type === 'CURRENCY'
            ? 'SUM'
            : undefined)) as any,
      }));

      finalRows = this.aggregateData(projectedRows, aggColumns, groupByField);
      const hasGroupCol = columns.some((c) => c.field === groupByField);
      if (!hasGroupCol) {
        columns = [
          {
            field: groupByField,
            label:
              groupByField.charAt(0).toUpperCase() + groupByField.slice(1),
            type: 'STRING',
          },
          ...columns,
        ];
      }
    } else {
      const aggColumns = report.columns
        .filter((c) => c.type === 'NUMBER' || c.type === 'CURRENCY')
        .map((c) => ({
          field: c.field,
          type: c.type,
          aggregation: 'SUM' as const,
        }));
      if (aggColumns.length > 0) {
        summary = this.aggregateData(projectedRows, aggColumns);
      }
    }

    const total = finalRows.length;
    const page = Math.max(1, Number(options.page) || 1);
    const limit = options.limit ? Number(options.limit) : total;
    const skip = (page - 1) * limit;
    const paginatedRows = finalRows.slice(skip, skip + limit);

    return {
      rows: paginatedRows,
      columns,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
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
