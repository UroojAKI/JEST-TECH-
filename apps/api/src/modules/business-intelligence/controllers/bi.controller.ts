import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Res,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { BiService } from '../services/bi.service';
import { KpiService } from '../services/kpi.service';
import { CreateKpiDto } from '../dto/create-kpi.dto';
import { UpdateKpiDto } from '../dto/update-kpi.dto';
import type { Response } from 'express';

@ApiTags('Business Intelligence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bi')
export class BiController {
  constructor(
    private readonly biService: BiService,
    private readonly kpiService: KpiService,
  ) {}

  // ── F-011 FIX: Pass actor's companyId to every BI query ──────────────────

  private getActorCompanyId(user: RequestUser): string {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }
    return companyId;
  }

  @Get('conversion')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get sales conversion funnel metrics' })
  getConversion(@CurrentUser() user: RequestUser) {
    return this.biService.getConversionMetrics(this.getActorCompanyId(user));
  }

  @Get('revenue')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get revenue and gross written premium analytics' })
  getRevenue(@CurrentUser() user: RequestUser) {
    return this.biService.getRevenueMetrics(this.getActorCompanyId(user));
  }

  @Get('loss-ratio')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get claims loss ratio analytics by product' })
  getLossRatio(@CurrentUser() user: RequestUser) {
    return this.biService.getLossRatioMetrics(this.getActorCompanyId(user));
  }

  @Get('renewal')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get policy renewal and retention analytics' })
  getRenewal(@CurrentUser() user: RequestUser) {
    return this.biService.getRenewalMetrics(this.getActorCompanyId(user));
  }

  @Get('sales')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get sales performance metrics and agent summaries' })
  getSales(@CurrentUser() user: RequestUser) {
    return this.biService.getSalesMetrics(this.getActorCompanyId(user));
  }

  @Get('growth')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get portfolio and organizational growth metrics' })
  getGrowth(@CurrentUser() user: RequestUser) {
    return this.biService.getGrowthMetrics(this.getActorCompanyId(user));
  }

  @Get('agent-performance')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get comprehensive agent performance analytics with GWP, active/lapsed ratios, and conversion rates' })
  getAgentPerformance(@CurrentUser() user: RequestUser) {
    return this.biService.getAgentPerformanceAnalytics(this.getActorCompanyId(user));
  }

  @Get('operational-action-centre')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get operational action centre queue with overdue tasks, pending inspections, and compliance holds' })
  getActionCentre(@CurrentUser() user: RequestUser) {
    return this.biService.getOperationalActionCentre(this.getActorCompanyId(user));
  }

  @Get('commission-intelligence')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get commission reconciliation intelligence comparing earned vs paid commissions' })
  getCommissionIntelligence(@CurrentUser() user: RequestUser) {
    return this.biService.getCommissionIntelligence(this.getActorCompanyId(user));
  }

  @Get('export/:type')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Export business intelligence report in CSV format' })
  async exportReport(
    @Param('type') type: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const report = await this.biService.exportBiReport(type, this.getActorCompanyId(user));
    res.setHeader('Content-Type', report.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
    return res.status(200).send(report.data);
  }

  @Get('kpi')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get calculated KPI values' })
  getKpiValues(@CurrentUser() user: RequestUser) {
    return this.biService.getKpiValues(this.getActorCompanyId(user));
  }

  // KPI Management
  @Get('kpi/definitions')
  @Roles(RoleType.ADMIN)
  listKpiDefinitions(@CurrentUser() user: RequestUser) {
    return this.kpiService.listKpis(this.getActorCompanyId(user));
  }

  @Post('kpi/definitions')
  @Roles(RoleType.ADMIN)
  createKpi(@Body() dto: CreateKpiDto, @CurrentUser() user: RequestUser) {
    return this.kpiService.createKpi({
      ...dto,
      userId: user.id,
      companyId: this.getActorCompanyId(user),
    });
  }

  @Patch('kpi/definitions/:id')
  @Roles(RoleType.ADMIN)
  updateKpi(
    @Param('id') id: string,
    @Body() dto: UpdateKpiDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.kpiService.updateKpi(id, dto, this.getActorCompanyId(user));
  }

  @Delete('kpi/definitions/:id')
  @Roles(RoleType.ADMIN)
  deleteKpi(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.kpiService.deleteKpi(id, this.getActorCompanyId(user));
  }

  @Post('kpi/seed')
  @Roles(RoleType.ADMIN)
  seedKpis(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    return this.kpiService.seedDefaultKpis(user.id, companyId);
  }
}
