import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ReportDataProvider,
  ReportParameters,
  ReportResult,
} from '../../reporting/interfaces/report-provider.interface';
import { ReportDataProviderRegistry } from '../../reporting/services/report-data-provider-registry.service';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class AuditReportProvider implements ReportDataProvider, OnModuleInit {
  constructor(
    private readonly registry: ReportDataProviderRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.registry.register(this, ['USER_ACTIVITY', 'AUDIT_TRAIL']);
  }

  supports(reportCode: string): boolean {
    return ['USER_ACTIVITY', 'AUDIT_TRAIL'].includes(reportCode.toUpperCase());
  }

  async execute(params: ReportParameters): Promise<ReportResult> {
    const reportCode = (params.parameters?.reportCode || '').toUpperCase();
    const whereClause: any = {};

    const companyId = params.companyId || params.parameters?.companyId;
    if (companyId) {
      whereClause.user = { companyId };
    }

    if (reportCode === 'USER_ACTIVITY') {
      whereClause.action = { in: ['LOGIN', 'LOGOUT', 'PASSWORD_RESET'] };
    } else if (params.parameters?.action && params.parameters.action !== 'ALL') {
      whereClause.action = params.parameters.action;
    }

    if (params.parameters?.entity && params.parameters.entity !== 'ALL') {
      whereClause.entity = params.parameters.entity;
    }

    if (params.parameters?.userId) {
      whereClause.userId = params.parameters.userId;
    }

    const startDate = params.parameters?.startDate || params.parameters?.from;
    const endDate = params.parameters?.endDate || params.parameters?.to;
    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) whereClause.createdAt.gte = new Date(startDate);
      if (endDate) whereClause.createdAt.lte = new Date(endDate);
    }

    const limit = params.limit ? Number(params.limit) : 1000;

    const logs = await this.prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const rows = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt,
      action: log.action,
      module: log.module || '',
      entity: log.entity,
      entityId: log.entityId,
      username: log.user
        ? `${log.user.firstName} ${log.user.lastName}`
        : 'system',
      ipAddress: log.ipAddress || '',
      userAgent: log.userAgent || '',
      correlationId: log.correlationId || '',
    }));

    return { rows };
  }

  async *stream(params: ReportParameters) {
    const res = await this.execute(params);
    for (const row of res.rows) {
      yield row;
    }
  }
}
