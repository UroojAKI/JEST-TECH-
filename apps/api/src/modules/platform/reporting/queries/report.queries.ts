export class GetReportQuery {
  constructor(public readonly idOrCode: string) {}
}

export class GetReportsQuery {
  constructor(
    public readonly filters: {
      category?: any;
      module?: any;
      status?: any;
      search?: string;
      isSystem?: boolean;
      companyId?: string | null;
    },
  ) {}
}

export class PreviewReportQuery {
  constructor(
    public readonly reportId: string,
    public readonly parameters: Record<string, any>,
    public readonly search?: string,
    public readonly companyId?: string | null,
    public readonly options?: {
      page?: number;
      limit?: number;
      groupBy?: string[];
      aggregations?: { column: string; func: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' }[];
    },
  ) {}
}

export class GetExecutionHistoryQuery {
  constructor(
    public readonly reportId: string,
    public readonly companyId?: string | null,
  ) {}
}
