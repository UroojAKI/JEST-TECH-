import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  @Roles(RoleType.ADMIN)
  getConversion(@CurrentUser() user: RequestUser) {
    return this.biService.getConversionMetrics(this.getActorCompanyId(user));
  }

  @Get('revenue')
  @Roles(RoleType.ADMIN)
  getRevenue(@CurrentUser() user: RequestUser) {
    return this.biService.getRevenueMetrics(this.getActorCompanyId(user));
  }

  @Get('loss-ratio')
  @Roles(RoleType.ADMIN)
  getLossRatio(@CurrentUser() user: RequestUser) {
    return this.biService.getLossRatioMetrics(this.getActorCompanyId(user));
  }

  @Get('renewal')
  @Roles(RoleType.ADMIN)
  getRenewal(@CurrentUser() user: RequestUser) {
    return this.biService.getRenewalMetrics(this.getActorCompanyId(user));
  }

  @Get('sales')
  @Roles(RoleType.ADMIN)
  getSales(@CurrentUser() user: RequestUser) {
    return this.biService.getSalesMetrics(this.getActorCompanyId(user));
  }

  @Get('growth')
  @Roles(RoleType.ADMIN)
  getGrowth(@CurrentUser() user: RequestUser) {
    return this.biService.getGrowthMetrics(this.getActorCompanyId(user));
  }

  @Get('kpi')
  @Roles(RoleType.ADMIN)
  getKpiValues(@CurrentUser() user: RequestUser) {
    return this.biService.getKpiValues(this.getActorCompanyId(user));
  }

  // KPI Management
  @Get('kpi/definitions')
  @Roles(RoleType.ADMIN)
  listKpiDefinitions() {
    return this.kpiService.listKpis();
  }

  @Post('kpi/definitions')
  @Roles(RoleType.ADMIN)
  createKpi(@Body() dto: CreateKpiDto, @CurrentUser() user: RequestUser) {
    return this.kpiService.createKpi({ ...dto, userId: user.id });
  }

  @Patch('kpi/definitions/:id')
  @Roles(RoleType.ADMIN)
  updateKpi(@Param('id') id: string, @Body() dto: UpdateKpiDto) {
    return this.kpiService.updateKpi(id, dto);
  }

  @Delete('kpi/definitions/:id')
  @Roles(RoleType.ADMIN)
  deleteKpi(@Param('id') id: string) {
    return this.kpiService.deleteKpi(id);
  }

  @Post('kpi/seed')
  @Roles(RoleType.ADMIN)
  seedKpis(@CurrentUser() user: RequestUser) {
    return this.kpiService.seedDefaultKpis(user.id);
  }
}
