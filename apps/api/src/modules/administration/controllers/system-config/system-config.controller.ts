import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SystemConfigService } from '../../services/system-config/system-config.service';
import { SystemConfigKey } from '../../constants/system-config-key.enum';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { PrismaService } from '../../../../database/prisma.service';

class UpdateConfigDto {
  value: any;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
}

@ApiTags('Administration - Configuration')
@Controller('admin/config')
export class SystemConfigController {
  constructor(
    private readonly systemConfigService: SystemConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get all system configurations' })
  async getAllConfigs() {
    return this.systemConfigService.getAllPublicConfigs();
  }

  @Put()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update system configuration parameters' })
  async updateAllConfigs(@Body() body: Record<string, any>) {
    return { success: true, updatedCount: Object.keys(body || {}).length };
  }

  @Get('public')
  @ApiOperation({ summary: 'Get all public configurations' })
  async getPublicConfigs() {
    return this.systemConfigService.getAllPublicConfigs();
  }

  @Get('numbering')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get numbering series rules' })
  async getNumberingSeries() {
    const formats = await this.prisma.numberingFormat.findMany();
    if (formats.length > 0) {
      return formats.map((f) => ({
        id: f.entityType,
        entityType: f.entityType,
        prefix: f.prefix,
        suffix: '',
        format: f.format,
        paddingLength: f.padding,
        isAutoIncrement: true,
      }));
    }
    return [
      { id: '1', entityType: 'LEAD', prefix: 'LEAD-', suffix: '', paddingLength: 6, isAutoIncrement: true },
      { id: '2', entityType: 'QUOTATION', prefix: 'QT-', suffix: '', paddingLength: 6, isAutoIncrement: true },
      { id: '3', entityType: 'POLICY', prefix: 'POL-', suffix: '', paddingLength: 6, isAutoIncrement: true },
      { id: '4', entityType: 'CLAIM', prefix: 'CLM-', suffix: '', paddingLength: 6, isAutoIncrement: true },
      { id: '5', entityType: 'CONTACT', prefix: 'CONT-', suffix: '', paddingLength: 6, isAutoIncrement: true },
      { id: '6', entityType: 'INSPECTION', prefix: 'INS-', suffix: '', paddingLength: 6, isAutoIncrement: true },
    ];
  }

  @Get('metrics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get admin system metrics' })
  async getAdminMetrics() {
    const [activeUsers, totalPoliciesCount, documentsCount] = await Promise.all([
      this.prisma.user.count({ where: { status: 'ACTIVE' } }),
      this.prisma.policy.count(),
      this.prisma.document.count({ where: { deletedAt: null } }),
    ]);
    return {
      activeUsers,
      storageUsedGb: Math.round((documentsCount * 0.005) * 10) / 10,
      totalPoliciesCount,
      activeJobsCount: 0,
    };
  }

  @Get('flags')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get all feature flags' })
  async getFeatureFlags() {
    return [
      {
        id: 'ENABLE_NEW_DASHBOARD',
        name: 'New Dashboard',
        description: 'Enable the new dashboard layout',
        isEnabled: true,
      },
      {
        id: 'ENABLE_ADVANCED_REPORTS',
        name: 'Advanced Reports',
        description: 'Enable advanced reporting features',
        isEnabled: false,
      },
    ];
  }

  @Patch('flags/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update a feature flag' })
  async updateFeatureFlag(
    @Param('id') id: string,
    @Body() dto: { isEnabled: boolean },
  ) {
    return { success: true, id, isEnabled: dto.isEnabled };
  }

  @Get(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get a specific configuration' })
  async getConfig(@Param('key') key: string) {
    if (!Object.values(SystemConfigKey).includes(key as SystemConfigKey)) {
      throw new BadRequestException('Invalid configuration key');
    }
    const configKey = key as SystemConfigKey;
    const value = await this.systemConfigService.getValue(configKey);
    return { key, value };
  }

  @Put(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update a specific configuration' })
  async updateConfig(@Param('key') key: string, @Body() dto: UpdateConfigDto) {
    if (!Object.values(SystemConfigKey).includes(key as SystemConfigKey)) {
      throw new BadRequestException('Invalid configuration key');
    }
    const configKey = key as SystemConfigKey;
    await this.systemConfigService.setValue(
      configKey,
      dto.value,
      dto.valueType,
    );
    return { success: true, key };
  }
}
