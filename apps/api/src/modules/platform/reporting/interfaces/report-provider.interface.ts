export interface ReportParameters {
  parameters: Record<string, any>;
  filters: any[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export interface ReportResult {
  rows: Record<string, any>[];
}

export interface ReportDataProvider {
  supports(reportCode: string): boolean;
  execute(params: ReportParameters): Promise<ReportResult>;
  stream?(
    params: ReportParameters,
  ): AsyncGenerator<Record<string, any>, void, unknown>;
}
