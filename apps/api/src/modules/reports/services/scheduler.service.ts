import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../database/prisma.service';
import { ReportBuilderService } from './report-builder.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly builder: ReportBuilderService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runScheduledReports() {
    this.logger.log('Running scheduled report execution...');

    // Find all active saved reports (future: add scheduling config per report)
    const reports = await this.prisma.savedReport.findMany({
      where: { isActive: true, isBuiltIn: false },
      take: 50,
    });

    for (const report of reports) {
      try {
        const run = await this.prisma.reportRun.create({
          data: {
            savedReportId: report.id,
            status: 'RUNNING',
            startedAt: new Date(),
          },
        });

        const result = await this.builder.runSavedReport(
          {
            dataSource: report.dataSource,
            columns: report.columns as any[],
            filters: report.filters as any[],
            sortBy: report.sortBy ?? undefined,
            sortDir: report.sortDir ?? undefined,
          },
          {},
        );

        await this.prisma.reportRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            rowCount: result.rowCount,
            completedAt: new Date(),
          },
        });

        this.logger.log(`Scheduled run complete: ${report.name} — ${result.rowCount} rows`);
      } catch (err: any) {
        this.logger.error(`Scheduled run failed for report ${report.name}: ${err.message}`);
      }
    }
  }

  async triggerManualRun(reportId: string, filters: any, userId: string) {
    const report = await this.prisma.savedReport.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    const run = await this.prisma.reportRun.create({
      data: {
        savedReportId: reportId,
        status: 'RUNNING',
        startedAt: new Date(),
        triggeredById: userId,
        appliedFilters: filters,
      },
    });

    try {
      const result = await this.builder.runSavedReport(
        {
          dataSource: report.dataSource,
          columns: report.columns as any[],
          filters: report.filters as any[],
          sortBy: report.sortBy ?? undefined,
          sortDir: report.sortDir ?? undefined,
        },
        filters,
      );

      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: {
          status: 'COMPLETED',
          rowCount: result.rowCount,
          completedAt: new Date(),
        },
      });

      return { run, result };
    } catch (err: any) {
      await this.prisma.reportRun.update({
        where: { id: run.id },
        data: { status: 'FAILED', errorMessage: err.message, completedAt: new Date() },
      });
      throw err;
    }
  }
}
