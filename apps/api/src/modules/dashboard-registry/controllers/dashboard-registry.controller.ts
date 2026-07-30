import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DashboardRegistryService } from '../services/dashboard-registry.service';
import { CreateDashboardRegistryDto, UpdateDashboardRegistryDto } from '../dto/dashboard-registry.dto';

@ApiTags('Dashboard Registry')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard-registry')
export class DashboardRegistryController {
  constructor(private readonly service: DashboardRegistryService) {}

  @Get()
  @ApiOperation({ summary: 'Get all registered dashboard configurations' })
  getAll() {
    return this.service.getAll();
  }

  @Get(':code')
  @ApiOperation({ summary: 'Get dashboard configuration by dashboard code' })
  getByCode(@Param('code') code: string) {
    return this.service.getByCode(code);
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Register a new dashboard configuration' })
  create(@Body() dto: CreateDashboardRegistryDto) {
    return this.service.create(dto);
  }

  @Put(':code')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update an existing dashboard configuration' })
  update(@Param('code') code: string, @Body() dto: UpdateDashboardRegistryDto) {
    return this.service.update(code, dto);
  }
}
