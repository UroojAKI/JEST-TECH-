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
    },
  ) {}
}

export class PreviewReportQuery {
  constructor(
    public readonly reportId: string,
    public readonly parameters: Record<string, any>,
    public readonly search?: string,
  ) {}
}

export class GetExecutionHistoryQuery {
  constructor(public readonly reportId: string) {}
}
