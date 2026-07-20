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

    if (reportCode === 'USER_ACTIVITY') {
      whereClause.action = { in: ['LOGIN', 'LOGOUT', 'PASSWORD_RESET'] };
    }

    const logs = await this.prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
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
