import { apiClient } from '../lib/api-client';

export interface ReportDefinition {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'SALES' | 'POLICIES' | 'RENEWALS' | 'CLAIMS' | 'FINANCE' | 'CUSTOMERS' | 'COMPLIANCE' | 'AUDIT';
  module: string;
  providerKey: string;
  isSystem: boolean;
  isFavorite?: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  columns: { key: string; label: string; dataType: string }[];
  defaultFilters: Record<string, any>;
  createdAt: string;
}

export interface ReportDataProvider {
  key: string;
  name: string;
  category: string;
  description: string;
  availableColumns: { key: string; label: string; dataType: 'STRING' | 'NUMBER' | 'DATE' | 'CURRENCY' | 'PERCENTAGE' }[];
  supportedAggregations: ('SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX')[];
}

export interface ExecuteReportParams {
  filters?: Record<string, any>;
  groupBy?: string[];
  aggregations?: { column: string; func: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' }[];
  sortColumn?: string;
  sortDirection?: 'ASC' | 'DESC';
  page?: number;
  limit?: number;
}

export interface ReportExecutionResult {
  reportId: string;
  reportName: string;
  executedAt: string;
  rowCount: number;
  columns: { key: string; label: string; dataType: string }[];
  data: Record<string, any>[];
  summary?: Record<string, number>;
}

export interface ReportSchedule {
  id: string;
  reportId: string;
  reportName: string;
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';
  recipients: string[];
  nextRunAt: string;
  lastRunAt?: string;
  status: 'ACTIVE' | 'PAUSED';
}

export interface ReportHistoryItem {
  id: string;
  reportId: string;
  reportName: string;
  executedBy: string;
  executedAt: string;
  durationMs: number;
  rowCount: number;
  format: 'PDF' | 'EXCEL' | 'CSV' | 'SCREEN';
  status: 'SUCCESS' | 'FAILED';
}

export const reportsRepository = {
  async getReports(params?: { category?: string; search?: string }): Promise<ReportDefinition[]> {
    const response = await apiClient.get('/reports', { params });
    return response.data;
  },

  async getReport(id: string): Promise<ReportDefinition> {
    const response = await apiClient.get(`/reports/${id}`);
    return response.data;
  },

  async createReport(data: Partial<ReportDefinition>): Promise<ReportDefinition> {
    const response = await apiClient.post('/reports', data);
    return response.data;
  },

  async updateReport(id: string, data: Partial<ReportDefinition>): Promise<ReportDefinition> {
    const response = await apiClient.put(`/reports/${id}`, data);
    return response.data;
  },

  async deleteReport(id: string): Promise<void> {
    await apiClient.delete(`/reports/${id}`);
  },

  async executeReport(id: string, params?: ExecuteReportParams): Promise<ReportExecutionResult> {
    const response = await apiClient.post(`/reports/${id}/execute`, params);
    return response.data;
  },

  async getDataProviders(): Promise<ReportDataProvider[]> {
    const response = await apiClient.get('/reports/providers');
    return response.data;
  },

  async exportReport(id: string, format: 'PDF' | 'EXCEL' | 'CSV'): Promise<Blob> {
    const response = await apiClient.get(`/reports/${id}/export`, {
      params: { format },
      responseType: 'blob',
    });
    return response.data;
  },

  async getSchedules(): Promise<ReportSchedule[]> {
    const response = await apiClient.get('/reports/schedules');
    return response.data;
  },

  async createSchedule(data: Partial<ReportSchedule>): Promise<ReportSchedule> {
    const response = await apiClient.post('/reports/schedules', data);
    return response.data;
  },

  async getExecutionHistory(): Promise<ReportHistoryItem[]> {
    const response = await apiClient.get('/reports/history');
    return response.data;
  },
};
