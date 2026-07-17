import { Controller, Get, Post, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import * as express from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { ReportLibraryService } from '../services/report-library.service';
import { ReportBuilderService } from '../services/report-builder.service';
import { ExportService } from '../services/export.service';
import { SchedulerService } from '../services/scheduler.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly library: ReportLibraryService,
    private readonly builder: ReportBuilderService,
    private readonly exporter: ExportService,
    private readonly scheduler: SchedulerService,
    private readonly prisma: PrismaService,
  ) {}

  // ─── Library ──────────────────────────────────────────────

  @Get('library')
  getLibrary() {
    return this.library.getAll();
  }

  @Get('library/:templateId')
  getTemplate(@Param('templateId') id: string) {
    return this.library.getById(id);
  }

  // ─── Run Built-in Report ──────────────────────────────────

  @Get('run/:templateId')
  async runBuiltIn(
    @Param('templateId') templateId: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('agentId') agentId?: string,
    @Query('type') type?: string,
  ) {
    return this.builder.runBuiltInReport(templateId, { from, to, status, agentId, type });
  }

  // ─── Export Built-in Report ───────────────────────────────

  @Get('export/:templateId')
  async exportBuiltIn(
    @Param('templateId') templateId: string,
    @Query('format') format: 'csv' | 'excel' | 'pdf' = 'csv',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Res() res: express.Response = {} as express.Response,
  ) {
    const result = await this.builder.runBuiltInReport(templateId, { from, to, status });
    const exported = await this.exporter.export(result.rows, result.columns, result.name, format);

    res.setHeader('Content-Type', exported.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.buffer);
  }

  // ─── Saved Reports CRUD ───────────────────────────────────

  @Post('saved')
  async createSavedReport(@Body() body: any, @CurrentUser() user: RequestUser) {
    return this.prisma.savedReport.create({
      data: {
        name: body.name,
        description: body.description,
        category: body.category,
        dataSource: body.dataSource,
        columns: body.columns,
        filters: body.filters ?? [],
        sortBy: body.sortBy,
        sortDir: body.sortDir ?? 'asc',
        createdById: user.id,
      },
    });
  }

  @Get('saved')
  async getSavedReports() {
    return this.prisma.savedReport.findMany({
      where: { isActive: true },
      include: { _count: { select: { runs: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('saved/:id')
  async getSavedReport(@Param('id') id: string) {
    return this.prisma.savedReport.findUnique({
      where: { id },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  // ─── Run Saved Report ─────────────────────────────────────

  @Post('saved/:id/run')
  async runSavedReport(
    @Param('id') id: string,
    @Body() filters: any,
    @CurrentUser() user: RequestUser,
  ) {
    return this.scheduler.triggerManualRun(id, filters, user.id);
  }

  // ─── Run History ──────────────────────────────────────────

  @Get('saved/:id/runs')
  async getRunHistory(@Param('id') id: string) {
    return this.prisma.reportRun.findMany({
      where: { savedReportId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
