import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

        // Update nextRun parameter
        await this.prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: { nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000) }, // mock next run in 24 hours
        });
      } catch (err: any) {
        this.logger.error(
          `Scheduled run failed for report ${schedule.report.name}: ${err.message}`,
        );
      }
    }
  }
}
