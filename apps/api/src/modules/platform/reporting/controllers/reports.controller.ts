import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
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
  ) {}

  // --- CRUD Operations ---

  @Post()
  @RequirePermissions('REPORT_CREATE')
  async createReport(@Body() dto: CreateReportDto, @CurrentUser() user: RequestUser) {
    const command = new CreateReportCommand(dto, user.id);
    return this.commands.handleCreateReport(command);
  }

  @Put(':id')
  @RequirePermissions('REPORT_CREATE')
  async updateReport(@Param('id') id: string, @Body() dto: UpdateReportDto, @CurrentUser() user: RequestUser) {
    const command = new UpdateReportCommand(id, dto, user.id);
    return this.commands.handleUpdateReport(command);
  }

  @Delete(':id')
  @RequirePermissions('REPORT_CREATE')
  async deleteReport(@Param('id') id: string, @CurrentUser() user: RequestUser) {
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

  @Get('favorites')
  @RequirePermissions('REPORT_VIEW')
  async getFavorites(@CurrentUser() user: RequestUser) {
    return this.queries.getFavorites(user.id);
  }

  @Get(':idOrCode')
  @RequirePermissions('REPORT_VIEW')
  async getReport(@Param('idOrCode') idOrCode: string) {
    const query = new GetReportQuery(idOrCode);
    return this.queries.handleGetReport(query);
  }

  // --- Execute & Preview ---

  @Post(':id/execute')
  @RequirePermissions('REPORT_EXECUTE')
  async executeReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: RequestUser,
    @Res() res: express.Response,
  ) {
    const format = dto.format || 'csv';

    if (dto.stream && format === 'csv') {
      const report = await this.queries.handleGetReport(new GetReportQuery(id));
      const provider = this.registry.getProvider(report.code);
      if (provider && provider.stream) {
        const filtersList = report.filters.map((f) => ({
          field: f.field,
          operator: f.operator,
          value: dto.parameters?.[f.field] !== undefined ? dto.parameters[f.field] : f.defaultValue,
        }));

        const generator = provider.stream({
          parameters: dto.parameters || {},
          filters: filtersList,
          search: dto.search,
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${report.code.toLowerCase()}_stream.csv"`);

        const csvStream = this.exporter.streamCsv(generator, report.columns);
        csvStream.pipe(res);
        return;
      }
    }

    const command = new ExecuteReportCommand(id, dto.parameters || {}, user.id);
    const result = await this.commands.handleExecuteReport(command, format);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Post(':id/preview')
  @RequirePermissions('REPORT_VIEW')
  async previewReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
  ) {
    const query = new PreviewReportQuery(id, dto.parameters || {}, dto.search);
    return this.queries.handlePreviewReport(query);
  }

  @Post(':id/drilldown')
  @RequirePermissions('REPORT_VIEW')
  async drilldownReport(
    @Param('id') id: string,
    @Body() dto: { field: string; value: any; parameters?: Record<string, any> },
  ) {
    const report = await this.queries.handleGetReport(new GetReportQuery(id));
    const combinedParams = { ...(dto.parameters || {}), [dto.field]: dto.value };
    const query = new PreviewReportQuery(report.id, combinedParams);
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
  async createSchedule(@Param('id') id: string, @Body() dto: CreateScheduleDto) {
    const command = new CreateScheduleCommand(id, dto);
    return this.commands.handleCreateSchedule(command);
  }

  @Put('schedules/:scheduleId')
  @RequirePermissions('REPORT_SCHEDULE')
  async updateSchedule(@Param('scheduleId') scheduleId: string, @Body() dto: UpdateScheduleDto) {
    const command = new UpdateScheduleCommand(scheduleId, dto);
    return this.commands.handleUpdateSchedule(command);
  }

  @Delete('schedules/:scheduleId')
  @RequirePermissions('REPORT_SCHEDULE')
  async deleteSchedule(@Param('scheduleId') scheduleId: string) {
    const command = new DeleteScheduleCommand(scheduleId);
    return this.commands.handleDeleteSchedule(command);
  }

  // --- Favorite Operations ---

  @Post(':id/favorite')
  @RequirePermissions('REPORT_VIEW')
  async favoriteReport(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.queries.favoriteReport(id, user.id);
  }

  @Delete(':id/favorite')
  @RequirePermissions('REPORT_VIEW')
  async unfavoriteReport(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.queries.unfavoriteReport(id, user.id);
  }

  // --- Saved Filters Operations ---

  @Post(':id/filters')
  @RequirePermissions('REPORT_VIEW')
  async saveFilter(
    @Param('id') id: string,
    @Body() dto: { name: string; filters: any },
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.saveFilter(id, user.id, dto.name, dto.filters);
  }

  @Get(':id/filters')
  @RequirePermissions('REPORT_VIEW')
  async getSavedFilters(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.queries.getSavedFilters(id, user.id);
  }

  @Delete('filters/:filterId')
  @RequirePermissions('REPORT_VIEW')
  async deleteSavedFilter(@Param('filterId') filterId: string, @CurrentUser() user: RequestUser) {
    return this.queries.deleteSavedFilter(filterId, user.id);
  }
}
