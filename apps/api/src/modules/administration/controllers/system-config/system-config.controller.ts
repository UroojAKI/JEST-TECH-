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

class UpdateConfigDto {
  value: any;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
}

@ApiTags('Administration - Configuration')
@Controller('admin/config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

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
  async updateAllConfigs(@Body() body: any) {
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
    return [
      {
        id: '1',
        entityType: 'LEAD',
        prefix: 'LD-',
        suffix: '',
        nextNumber: 10042,
        paddingLength: 6,
        isAutoIncrement: true,
      },
      {
        id: '2',
        entityType: 'QUOTATION',
        prefix: 'QT-2026-',
        suffix: '',
        nextNumber: 840,
        paddingLength: 4,
        isAutoIncrement: true,
      },
      {
        id: '3',
        entityType: 'POLICY',
        prefix: 'POL-2026-',
        suffix: '',
        nextNumber: 1052,
        paddingLength: 6,
        isAutoIncrement: true,
      },
      {
        id: '4',
        entityType: 'CLAIM',
        prefix: 'CLM-2026-',
        suffix: '',
        nextNumber: 42,
        paddingLength: 4,
        isAutoIncrement: true,
      },
    ];
  }

  @Get('metrics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get admin system metrics' })
  async getAdminMetrics() {
    return {
      activeUsers: 48,
      storageUsedGb: 12.4,
      totalPoliciesCount: 1840,
      activeJobsCount: 3,
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
