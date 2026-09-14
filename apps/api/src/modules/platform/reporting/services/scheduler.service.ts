import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReportScheduleFrequency } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { ReportCommandsService } from '../commands/report-commands.service';
import { ExecuteReportCommand } from '../commands/report.commands';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly commands: ReportCommandsService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async runScheduledReports() {
    this.logger.log('Running scheduled report execution...');

    // Find all active schedules
    const schedules = await this.prisma.reportSchedule.findMany({
      where: { active: true },
      include: { report: true },
      take: 50,
    });

    for (const schedule of schedules) {
      try {
        this.logger.log(
          `Running scheduled report: ${schedule.report.name} (${schedule.report.id})`,
        );

        // Execute the report (default system user or null for system runs)
        const command = new ExecuteReportCommand(schedule.reportId, {}, null);
        await this.commands.handleExecuteReport(command, 'csv');

        // Compute authoritative nextRun from schedule frequency
        const nextRun = this.computeNextRun(schedule.frequency);
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { nextRun },
        });
      } catch (err: any) {
        this.logger.error(
          `Scheduled run failed for report ${schedule.report.name}: ${err.message}`,
        );
      }
    }
  }

  private computeNextRun(
    frequency: ReportScheduleFrequency,
    fromDate: Date = new Date(),
  ): Date {
    const next = new Date(fromDate);
    switch (frequency) {
      case ReportScheduleFrequency.DAILY:
        next.setDate(next.getDate() + 1);
        break;
      case ReportScheduleFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case ReportScheduleFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1);
        break;
    }
    return next;
  }
}
