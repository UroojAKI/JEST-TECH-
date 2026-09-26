import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../../database/prisma.service';
import { ReportCommandsService } from '../commands/report-commands.service';
import { ReportQueriesService } from '../queries/report-queries.service';
import { ExportService } from '../services/export.service';
import { ReportDataProviderRegistry } from '../services/report-data-provider-registry.service';
import {
  CreateReportDto,
  UpdateReportDto,
  ExecuteReportDto,
  CreateScheduleDto,
  UpdateScheduleDto,
  CreateTopLevelScheduleDto,
  SaveFilterDto,
} from '../dto/report.dto';
import {
  CreateReportCommand,
  UpdateReportCommand,
  DeleteReportCommand,
  ExecuteReportCommand,
  CreateScheduleCommand,
  UpdateScheduleCommand,
  DeleteScheduleCommand,
} from '../commands/report.commands';
import {
  GetReportQuery,
  GetReportsQuery,
  PreviewReportQuery,
  GetExecutionHistoryQuery,
} from '../queries/report.queries';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly commands: ReportCommandsService,
    private readonly queries: ReportQueriesService,
    private readonly registry: ReportDataProviderRegistry,
    private readonly exporter: ExportService,
    private readonly prisma: PrismaService,
  ) {}

  // --- CRUD Operations ---

  @Post()
  @RequirePermissions('REPORT_CREATE')
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const command = new CreateReportCommand(dto, user.id);
    return this.commands.handleCreateReport(command);
  }

  @Put(':id')
  @RequirePermissions('REPORT_CREATE')
  async updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const command = new UpdateReportCommand(id, dto, user.id);
    return this.commands.handleUpdateReport(command);
  }

  @Delete(':id')
  @RequirePermissions('REPORT_CREATE')
  async deleteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const command = new DeleteReportCommand(id, user.id);
    return this.commands.handleDeleteReport(command);
  }

  @Get()
  @RequirePermissions('REPORT_VIEW')
  async getReports(
    @Query('category') category?: string,
    @Query('module') module?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    const query = new GetReportsQuery({ category, module, status, search });
    return this.queries.handleGetReports(query);
  }

  @Get('system')
  @RequirePermissions('REPORT_VIEW')
  async getSystemReports() {
    const query = new GetReportsQuery({ isSystem: true });
    return this.queries.handleGetReports(query);
  }

  @Get('custom')
  @RequirePermissions('REPORT_VIEW')
  async getCustomReports() {
    const query = new GetReportsQuery({ isSystem: false });
    return this.queries.handleGetReports(query);
  }

  @Get('providers')
  @RequirePermissions('REPORT_VIEW')
  async getProviders() {
    return [
      {
        code: 'LEAD_ACQUISITION',
        name: 'Lead Acquisition & Conversion Data Provider',
      },
      {
        code: 'POLICY_RENEWALS',
        name: 'Policy Renewals & Retention Data Provider',
      },
      {
        code: 'FINANCE_COMMISSIONS',
        name: 'Finance & Agent Commission Ledger Data Provider',
      },
    ];
  }

  @Get('schedules')
  @RequirePermissions('REPORT_SCHEDULE')
  async getAllSchedules(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const schedules = await this.prisma.reportSchedule.findMany({
      where: companyId ? { companyId } : undefined,
      include: { report: true },
      orderBy: { id: 'desc' },
    });
    return schedules.map((s) => ({
      id: s.id,
      reportId: s.reportId,
      reportName: s.report?.name || 'Automated Report',
      frequency: s.frequency,
      cronExpression: s.cronExpression,
      timezone: s.timezone,
      status: s.active ? 'ACTIVE' : 'INACTIVE',
      nextRun: s.nextRun,
    }));
  }

  @Post('schedules')
  @RequirePermissions('REPORT_SCHEDULE')
  async createTopLevelSchedule(
    @Body() dto: CreateTopLevelScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    let report = await this.prisma.report.findFirst({
      where: {
        ...(companyId ? { OR: [{ companyId }, { companyId: null }] } : {}),
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!report) {
      report = await this.prisma.report.create({
        data: {
          name: dto.reportName || 'Automated Report',
          code: `AUTO_REP_${Date.now()}`,
          category: 'SALES',
          module: 'LEADS',
          type: 'TABULAR',
          companyId,
          createdById: user.id,
        },
      });
    }

    const freq =
      dto.frequency === 'DAILY'
        ? 'DAILY'
        : dto.frequency === 'MONTHLY'
          ? 'MONTHLY'
          : 'WEEKLY';

    const cron =
      freq === 'DAILY'
        ? '0 0 * * *'
        : freq === 'MONTHLY'
          ? '0 0 1 * *'
          : '0 0 * * 1';

    const schedule = await this.prisma.reportSchedule.create({
      data: {
        companyId,
        reportId: report.id,
        frequency: freq as any,
        cronExpression: cron,
        timezone: 'UTC',
        active: true,
      },
      include: { report: true },
    });

    return {
      id: schedule.id,
      reportId: schedule.reportId,
      reportName: schedule.report?.name || dto.reportName || 'Automated Report',
      frequency: schedule.frequency,
      cronExpression: schedule.cronExpression,
      recipients: dto.recipients || [],
      format: dto.format || 'PDF',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
    };
  }

  @Get('history')
  @RequirePermissions('REPORT_VIEW')
  async getAllHistory(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const executions = await this.prisma.reportExecution.findMany({
      where: companyId ? { companyId } : undefined,
      include: { report: true },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
    return executions.map((e) => ({
      id: e.id,
      reportId: e.reportId,
      reportName: e.report?.name || 'Report',
      format: 'PDF',
      generatedAt: e.startedAt?.toISOString() || new Date().toISOString(),
      duration: e.duration,
      recordCount: e.recordCount,
      status: e.status === 'COMPLETED' ? 'SUCCESS' : e.status,
    }));
  }

  @Get(':idOrCode')
  @RequirePermissions('REPORT_VIEW')
  async getReport(@Param('idOrCode') idOrCode: string) {
    const query = new GetReportQuery(idOrCode);
    return this.queries.handleGetReport(query);
  }

  @Get(':id/export')
  @RequirePermissions('REPORT_EXECUTE')
  async exportReport(
    @Param('id') id: string,
    @Query('format') format: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const fmt = (format as 'pdf' | 'excel' | 'csv') || 'pdf';
    const companyId = user.companyId || (user as any).organizationId;
    const command = new ExecuteReportCommand(id, {}, user.id, companyId);
    const result = await this.commands.handleExecuteReport(command, fmt);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Post(':id/execute')
  @RequirePermissions('REPORT_EXECUTE')
  async executeReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const format = dto.format || 'csv';
    const companyId = user.companyId || (user as any).organizationId;

    if (dto.stream && format === 'csv') {
      const report = await this.queries.handleGetReport(new GetReportQuery(id));
      const provider = this.registry.getProvider(report.code);
      if (provider && provider.stream) {
        const filtersList = report.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value:
            dto.parameters?.[f.field] !== undefined
              ? dto.parameters[f.field]
              : f.defaultValue,
        }));

        const generator = provider.stream({
          parameters: { ...(dto.parameters || {}), companyId },
          filters: filtersList,
          search: dto.search,
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="${report.code.toLowerCase()}_stream.csv"`,
        );

        const csvStream = this.exporter.streamCsv(generator, report.columns);
        csvStream.pipe(res);
        return;
      }
    }

    const command = new ExecuteReportCommand(
      id,
      dto.parameters || {},
      user.id,
      companyId,
    );
    const result = await this.commands.handleExecuteReport(command, format);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Post(':id/preview')
  @RequirePermissions('REPORT_VIEW')
  async previewReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const query = new PreviewReportQuery(
      id,
      dto.parameters || {},
      dto.search,
      companyId,
    );
    return this.queries.handlePreviewReport(query);
  }

  @Post(':id/drilldown')
  @RequirePermissions('REPORT_VIEW')
  async drilldownReport(
    @Param('id') id: string,
    @Body()
    dto: { field: string; value: any; parameters?: Record<string, any> },
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const report = await this.queries.handleGetReport(new GetReportQuery(id));
    const combinedParams = {
      ...(dto.parameters || {}),
      [dto.field]: dto.value,
    };
    const query = new PreviewReportQuery(
      report.id,
      combinedParams,
      undefined,
      companyId,
    );
    return this.queries.handlePreviewReport(query);
  }

  @Get(':id/history')
  @RequirePermissions('REPORT_VIEW')
  async getExecutionHistory(@Param('id') id: string) {
    const query = new GetExecutionHistoryQuery(id);
    return this.queries.handleGetExecutionHistory(query);
  }

  // --- Schedules ---

  @Post(':id/schedules')
  @RequirePermissions('REPORT_SCHEDULE')
  async createSchedule(
    @Param('id') id: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const command = new CreateScheduleCommand(id, dto, companyId);
    return this.commands.handleCreateSchedule(command);
  }

  @Put('schedules/:scheduleId')
  @RequirePermissions('REPORT_SCHEDULE')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
  ) {
    const command = new UpdateScheduleCommand(scheduleId, dto);
    return this.commands.handleUpdateSchedule(command);
  }

  @Delete('schedules/:scheduleId')
  @RequirePermissions('REPORT_SCHEDULE')
  async deleteSchedule(
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }
    if (companyId && schedule.companyId && schedule.companyId !== companyId) {
      throw new ForbiddenException(
        'Cross-organization schedule deletion is strictly prohibited',
      );
    }
    const command = new DeleteScheduleCommand(scheduleId);
    return this.commands.handleDeleteSchedule(command);
  }

  // --- Favorite Operations ---

  @Post(':id/favorite')
  @RequirePermissions('REPORT_VIEW')
  async favoriteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.favoriteReport(id, user.id);
  }

  @Delete(':id/favorite')
  @RequirePermissions('REPORT_VIEW')
  async unfavoriteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.unfavoriteReport(id, user.id);
  }

  // --- Saved Filters Operations ---

  @Post(':id/filters')
  @RequirePermissions('REPORT_VIEW')
  async saveFilter(
    @Param('id') id: string,
    @Body() dto: SaveFilterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.saveFilter(id, user.id, dto.name, dto.filters);
  }

  @Get(':id/filters')
  @RequirePermissions('REPORT_VIEW')
  async getSavedFilters(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.getSavedFilters(id, user.id);
  }

  @Delete('filters/:filterId')
  @RequirePermissions('REPORT_VIEW')
  async deleteSavedFilter(
    @Param('filterId') filterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.deleteSavedFilter(filterId, user.id);
  }
}
