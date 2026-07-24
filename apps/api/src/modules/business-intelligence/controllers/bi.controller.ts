import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
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

  @Get('conversion')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getConversion() {
    return this.biService.getConversionMetrics();
  }

  @Get('revenue')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getRevenue() {
    return this.biService.getRevenueMetrics();
  }

  @Get('loss-ratio')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getLossRatio() {
    return this.biService.getLossRatioMetrics();
  }

  @Get('renewal')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getRenewal() {
    return this.biService.getRenewalMetrics();
  }

  @Get('sales')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getSales() {
    return this.biService.getSalesMetrics();
  }

  @Get('growth')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getGrowth() {
    return this.biService.getGrowthMetrics();
  }

  @Get('kpi')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  getKpiValues() {
    return this.biService.getKpiValues();
  }

  // KPI Management
  @Get('kpi/definitions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  listKpiDefinitions() {
    return this.kpiService.listKpis();
  }

  @Post('kpi/definitions')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  createKpi(@Body() dto: CreateKpiDto, @CurrentUser() user: RequestUser) {
    return this.kpiService.createKpi({ ...dto, userId: user.id });
  }

  @Patch('kpi/definitions/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  updateKpi(@Param('id') id: string, @Body() dto: UpdateKpiDto) {
    return this.kpiService.updateKpi(id, dto);
  }

  @Delete('kpi/definitions/:id')
  @Roles(RoleType.ADMIN, RoleType.SUPER_ADMIN)
  deleteKpi(@Param('id') id: string) {
    return this.kpiService.deleteKpi(id);
  }

  @Post('kpi/seed')
  @Roles(RoleType.SUPER_ADMIN)
  seedKpis(@CurrentUser() user: RequestUser) {
    return this.kpiService.seedDefaultKpis(user.id);
  }
}
