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
import { RoleType } from '@prisma/client';
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

  private resolveCompanyId(user: RequestUser): string {
    const companyId = user.companyId ?? (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for report operations');
    }
    return companyId;
  }

  // --- CRUD Operations ---

  @Post()
  @RequirePermissions('report:create')
  async createReport(
    @Body() dto: CreateReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const command = new CreateReportCommand(dto, user.id, companyId);
    return this.commands.handleCreateReport(command);
  }

  @Put(':id')
  @RequirePermissions('report:create')
  async updateReport(
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const report = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
    });
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    if (companyId && report.companyId && report.companyId !== companyId) {
      throw new ForbiddenException(
        'Cross-organization report update is strictly prohibited',
      );
    }
    const command = new UpdateReportCommand(id, dto, user.id, companyId);
    return this.commands.handleUpdateReport(command);
  }

  @Delete(':id')
  @RequirePermissions('report:create')
  async deleteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const report = await this.prisma.report.findFirst({
      where: { id, deletedAt: null },
    });
    if (!report) {
      throw new NotFoundException(`Report ${id} not found`);
    }
    if (companyId && report.companyId && report.companyId !== companyId) {
      throw new ForbiddenException(
        'Cross-organization report deletion is strictly prohibited',
      );
    }
    const command = new DeleteReportCommand(id, user.id);
    return this.commands.handleDeleteReport(command);
  }

  @Get()
  @RequirePermissions('report:read')
  async getReports(
    @Query('category') category?: string,
    @Query('module') module?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    const companyId = user ? this.resolveCompanyId(user) : undefined;
    if (!companyId) throw new ForbiddenException('Company context is required for report operations');
    const query = new GetReportsQuery({
      category,
      module,
      status,
      search,
      companyId,
    });
    return this.queries.handleGetReports(query);
  }

  @Get('system')
  @RequirePermissions('report:read')
  async getSystemReports() {
    const query = new GetReportsQuery({ isSystem: true });
    return this.queries.handleGetReports(query);
  }

  @Get('custom')
  @RequirePermissions('report:read')
  async getCustomReports(@CurrentUser() user: RequestUser) {
    const companyId = this.resolveCompanyId(user);
    const query = new GetReportsQuery({ isSystem: false, companyId });
    return this.queries.handleGetReports(query);
  }

  @Post('system/seed')
  @RequirePermissions('report:create')
  async seedSystemReports(@CurrentUser() user: RequestUser) {
    if (user.role !== RoleType.ADMIN) {
      throw new ForbiddenException('Only a company administrator can seed system report definitions');
    }

    const definitions = [
      { code: 'LEAD_SUMMARY', name: 'Lead Summary', description: 'Tenant leads with source, assigned agent, status and conversion marker.', category: 'SALES', module: 'LEADS', columns: [['leadCode','Lead Code','STRING'],['contactName','Contact','STRING'],['source','Source','STRING'],['assignedAgentName','Assigned Agent','STRING'],['status','Status','STRING'],['createdAt','Created At','DATE'],['lastActivityAt','Last Activity','DATE'],['converted','Converted','STRING']] },
      { code: 'LEAD_CONVERSION', name: 'Lead Conversion', description: 'Lead totals by qualification, conversion and loss with conversion rate.', category: 'SALES', module: 'LEADS', columns: [['totalLeads','Total Leads','NUMBER'],['qualifiedLeads','Qualified Leads','NUMBER'],['convertedLeads','Converted Leads','NUMBER'],['lostLeads','Lost Leads','NUMBER'],['conversionRate','Conversion Rate','STRING']] },
      { code: 'CLAIMS_REGISTER', name: 'Claims Register', description: 'Tenant claims with policy, claimant, status, claimed and approved settlement amounts.', category: 'CLAIMS', module: 'CLAIMS', columns: [['claimNumber','Claim Number','STRING'],['policyNumber','Policy Number','STRING'],['contactName','Customer','STRING'],['status','Status','STRING'],['claimAmount','Claim Amount','CURRENCY'],['surveyorName','Surveyor','STRING'],['settlementAmount','Approved Amount','CURRENCY']] },
      { code: 'CLAIMS_PENDING', name: 'Pending Claims', description: 'Open claims requiring registration, survey, assessment or payment action.', category: 'CLAIMS', module: 'CLAIMS', columns: [['claimNumber','Claim Number','STRING'],['policyNumber','Policy Number','STRING'],['contactName','Customer','STRING'],['status','Status','STRING'],['claimAmount','Claim Amount','CURRENCY'],['surveyorName','Surveyor','STRING'],['settlementAmount','Approved Amount','CURRENCY']] },
      { code: 'LOSS_RATIO', name: 'Claims Loss Ratio', description: 'Approved/settled claim amount divided by successful premium collections for the selected period.', category: 'CLAIMS', module: 'CLAIMS', columns: [['claimsPaid','Claims Paid','CURRENCY'],['premiumCollected','Premium Collected','CURRENCY'],['lossRatio','Loss Ratio','STRING']] },
      { code: 'ACTIVE_POLICIES', name: 'Active Policies', description: 'Active tenant policies with customer, product, insurer, premium and expiry.', category: 'POLICY', module: 'POLICIES', columns: [['policyNumber','Policy Number','STRING'],['contactName','Customer','STRING'],['productName','Product','STRING'],['insurerName','Insurer','STRING'],['premiumAmount','Premium','CURRENCY'],['status','Status','STRING'],['expiryDate','Expiry Date','DATE']] },
      { code: 'EXPIRING_POLICIES', name: 'Expiring Policies', description: 'Active tenant policies expiring within the configured days window.', category: 'POLICY', module: 'POLICIES', columns: [['policyNumber','Policy Number','STRING'],['contactName','Customer','STRING'],['productName','Product','STRING'],['insurerName','Insurer','STRING'],['premiumAmount','Premium','CURRENCY'],['status','Status','STRING'],['expiryDate','Expiry Date','DATE']] },
      { code: 'POLICY_REGISTER', name: 'Policy Register', description: 'Tenant policy register with product, insurer, premium, status and expiry.', category: 'POLICY', module: 'POLICIES', columns: [['policyNumber','Policy Number','STRING'],['contactName','Customer','STRING'],['productName','Product','STRING'],['insurerName','Insurer','STRING'],['premiumAmount','Premium','CURRENCY'],['status','Status','STRING'],['expiryDate','Expiry Date','DATE']] },
      { code: 'REVENUE_REPORT', name: 'Revenue Report', description: 'Successful premium payment collections and transaction averages.', category: 'FINANCE', module: 'REPORTS', columns: [['period','Period','STRING'],['totalRevenue','Total Revenue','CURRENCY'],['transactionCount','Transactions','NUMBER'],['averageTransaction','Average Transaction','CURRENCY']] },
      { code: 'PREMIUM_COLLECTION', name: 'Premium Collection', description: 'Tenant premium payment register including method, transaction reference and status.', category: 'FINANCE', module: 'REPORTS', columns: [['paymentId','Payment ID','STRING'],['policyNumber','Policy Number','STRING'],['clientName','Customer','STRING'],['amount','Amount','CURRENCY'],['paymentMethod','Payment Method','STRING'],['transactionId','Transaction ID','STRING'],['status','Status','STRING'],['paymentDate','Payment Date','DATE']] },
      { code: 'RENEWAL_REVENUE', name: 'Renewal Revenue', description: 'Renewal records and premium amounts for policies in the tenant.', category: 'FINANCE', module: 'REPORTS', columns: [['renewalNumber','Renewal Number','STRING'],['policyNumber','Policy Number','STRING'],['clientName','Customer','STRING'],['premiumAmount','Premium','CURRENCY'],['status','Status','STRING'],['renewalDate','Renewal Date','DATE']] },
      { code: 'USER_ACTIVITY', name: 'User Activity', description: 'Tenant user login, logout and password reset audit events.', category: 'AUDIT', module: 'REPORTS', columns: [['id','Event ID','STRING'],['timestamp','Timestamp','DATE'],['action','Action','STRING'],['module','Module','STRING'],['entity','Entity','STRING'],['entityId','Entity ID','STRING'],['username','User','STRING'],['ipAddress','IP Address','STRING'],['userAgent','User Agent','STRING'],['correlationId','Correlation ID','STRING']] },
      { code: 'AUDIT_TRAIL', name: 'Audit Trail', description: 'Tenant audit events with actor, entity, action and request metadata.', category: 'AUDIT', module: 'REPORTS', columns: [['id','Event ID','STRING'],['timestamp','Timestamp','DATE'],['action','Action','STRING'],['module','Module','STRING'],['entity','Entity','STRING'],['entityId','Entity ID','STRING'],['username','User','STRING'],['ipAddress','IP Address','STRING'],['userAgent','User Agent','STRING'],['correlationId','Correlation ID','STRING']] },
    ];

    await this.prisma.$transaction(async (tx) => {
      for (const definition of definitions) {
        const columns = definition.columns.map(([field, label, type], order) => ({
          field, label, type, order, visible: true, sortable: true, filterable: true,
        }));
        await tx.report.upsert({
          where: { code: definition.code },
          create: {
            code: definition.code,
            name: definition.name,
            description: definition.description,
            category: definition.category as any,
            module: definition.module as any,
            type: 'TABULAR',
            status: 'ACTIVE',
            isSystem: true,
            shared: true,
            companyId: null,
            createdById: user.id,
            columns: { create: columns },
          },
          update: {
            name: definition.name,
            description: definition.description,
            category: definition.category as any,
            module: definition.module as any,
            status: 'ACTIVE',
            isSystem: true,
            shared: true,
            companyId: null,
            columns: { deleteMany: {}, create: columns },
          },
        });
      }
    });

    return { seeded: definitions.length, codes: definitions.map((definition) => definition.code) };
  }

  @Get('providers')
  @RequirePermissions('report:read')
  async getProviders() {
    return [
      { code: 'LEAD_SUMMARY', name: 'Lead Summary' },
      { code: 'LEAD_CONVERSION', name: 'Lead Conversion' },
      { code: 'CLAIMS_REGISTER', name: 'Claims Register' },
      { code: 'CLAIMS_PENDING', name: 'Pending Claims' },
      { code: 'LOSS_RATIO', name: 'Claims Loss Ratio' },
      { code: 'ACTIVE_POLICIES', name: 'Active Policies' },
      { code: 'EXPIRING_POLICIES', name: 'Expiring Policies' },
      { code: 'POLICY_REGISTER', name: 'Policy Register' },
      { code: 'REVENUE_REPORT', name: 'Revenue Report' },
      { code: 'PREMIUM_COLLECTION', name: 'Premium Collection' },
      { code: 'RENEWAL_REVENUE', name: 'Renewal Revenue' },
      { code: 'USER_ACTIVITY', name: 'User Activity' },
      { code: 'AUDIT_TRAIL', name: 'Audit Trail' },
    ];
  }

  @Get('schedules')
  @RequirePermissions('report:create')
  async getAllSchedules(@CurrentUser() user: RequestUser) {
    const companyId = this.resolveCompanyId(user);
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
  @RequirePermissions('report:create')
  async createTopLevelSchedule(
    @Body() dto: CreateTopLevelScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
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
  @RequirePermissions('report:read')
  async getAllHistory(@CurrentUser() user: RequestUser) {
    const companyId = this.resolveCompanyId(user);
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
  @RequirePermissions('report:read')
  async getReport(
    @Param('idOrCode') idOrCode: string,
    @CurrentUser() user: RequestUser,
  ) {
    const query = new GetReportQuery(idOrCode);
    const report = await this.queries.handleGetReport(query);
    const companyId = this.resolveCompanyId(user);
    if (companyId && report.companyId && report.companyId !== companyId) {
      throw new ForbiddenException(
        'Cross-organization report access is strictly prohibited',
      );
    }
    return report;
  }

  @Get(':id/export')
  @RequirePermissions('report:export')
  async exportReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
    @Query('format') format = 'pdf',
    @Query('groupBy') groupBy?: string,
    @Query('dateRange') dateRange?: string,
  ) {
    const fmt = (format as 'pdf' | 'excel' | 'csv') || 'pdf';
    const companyId = this.resolveCompanyId(user);
    const parameters: Record<string, any> = {};
    if (dateRange) parameters.dateRange = dateRange;

    const command = new ExecuteReportCommand(
      id,
      parameters,
      user.id,
      companyId,
      {
        groupBy: groupBy ? groupBy.split(',') : undefined,
      },
    );
    const result = await this.commands.handleExecuteReport(command, fmt);

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.filename}"`,
    );
    res.send(result.buffer);
  }

  @Post(':id/execute')
  @RequirePermissions('report:export')
  async executeReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const format = dto.format || 'csv';
    const companyId = this.resolveCompanyId(user);

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
          companyId,
          parameters: { ...(dto.parameters || {}), reportCode: report.code },
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
      {
        search: dto.search,
        groupBy: dto.groupBy,
        aggregations: dto.aggregations,
        limit: dto.limit,
        page: dto.page,
      },
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
  @RequirePermissions('report:read')
  async previewReport(
    @Param('id') id: string,
    @Body() dto: ExecuteReportDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const query = new PreviewReportQuery(
      id,
      dto.parameters || {},
      dto.search,
      companyId,
      {
        page: dto.page,
        limit: dto.limit,
        groupBy: dto.groupBy,
        aggregations: dto.aggregations,
      },
    );
    return this.queries.handlePreviewReport(query);
  }

  @Post(':id/drilldown')
  @RequirePermissions('report:read')
  async drilldownReport(
    @Param('id') id: string,
    @Body()
    dto: { field: string; value: any; parameters?: Record<string, any> },
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
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
  @RequirePermissions('report:read')
  async getExecutionHistory(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const query = new GetExecutionHistoryQuery(id, companyId);
    return this.queries.handleGetExecutionHistory(query);
  }

  // --- Schedules ---

  @Post(':id/schedules')
  @RequirePermissions('report:create')
  async createSchedule(
    @Param('id') id: string,
    @Body() dto: CreateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const command = new CreateScheduleCommand(id, dto, companyId);
    return this.commands.handleCreateSchedule(command);
  }

  @Put('schedules/:scheduleId')
  @RequirePermissions('report:create')
  async updateSchedule(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: UpdateScheduleDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
    const schedule = await this.prisma.reportSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) {
      throw new NotFoundException(`Schedule ${scheduleId} not found`);
    }
    if (companyId && schedule.companyId && schedule.companyId !== companyId) {
      throw new ForbiddenException(
        'Cross-organization schedule update is strictly prohibited',
      );
    }
    const command = new UpdateScheduleCommand(scheduleId, dto);
    return this.commands.handleUpdateSchedule(command);
  }

  @Delete('schedules/:scheduleId')
  @RequirePermissions('report:create')
  async deleteSchedule(
    @Param('scheduleId') scheduleId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.resolveCompanyId(user);
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
    const command = new DeleteScheduleCommand(scheduleId, companyId);
    return this.commands.handleDeleteSchedule(command);
  }

  // --- Favorite Operations ---

  @Post(':id/favorite')
  @RequirePermissions('report:read')
  async favoriteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.favoriteReport(id, user.id);
  }

  @Delete(':id/favorite')
  @RequirePermissions('report:read')
  async unfavoriteReport(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.unfavoriteReport(id, user.id);
  }

  // --- Saved Filters Operations ---

  @Post(':id/filters')
  @RequirePermissions('report:read')
  async saveFilter(
    @Param('id') id: string,
    @Body() dto: SaveFilterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.saveFilter(id, user.id, dto.name, dto.filters);
  }

  @Get(':id/filters')
  @RequirePermissions('report:read')
  async getSavedFilters(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.getSavedFilters(id, user.id);
  }

  @Delete('filters/:filterId')
  @RequirePermissions('report:read')
  async deleteSavedFilter(
    @Param('filterId') filterId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.queries.deleteSavedFilter(filterId, user.id);
  }
}
