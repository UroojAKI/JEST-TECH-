import {
  Controller,
  Get,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SystemConfigService } from '../../services/system-config/system-config.service';
import { SystemConfigKey } from '../../constants/system-config-key.enum';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { RoleType } from '@prisma/client';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { PrismaService } from '../../../../database/prisma.service';
import {
  IsNotEmpty,
  IsString,
  IsIn,
  IsBoolean,
  IsInt,
  Max,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class UpdateConfigDto {
  @IsNotEmpty()
  value: any;

  @IsString()
  @IsIn(['STRING', 'NUMBER', 'BOOLEAN', 'JSON'])
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
}

export class UpdateNumberingFormatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(12)
  @Matches(/^[A-Z0-9_-]+$/, { message: 'Prefix must contain only uppercase letters, numbers, underscore or hyphen' })
  prefix: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  format: string;

  @IsInt()
  @Min(1)
  @Max(12)
  padding: number;
}
export class UpdateFeatureFlagDto {
  @IsBoolean()
  isEnabled: boolean;
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
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get configured system parameters' })
  async getAllConfigs(@CurrentUser() user: RequestUser) {
    const isPlatformAdmin = (user as any).permissions?.includes('*');
    const configs = await this.prisma.systemConfig.findMany({
      where: {
        key: { in: Object.values(SystemConfigKey) },
        ...(!isPlatformAdmin ? { isPublic: true } : {}),
      },
      orderBy: { key: 'asc' },
    });
    return Object.fromEntries(configs.map((config) => [
      config.key,
      this.parseConfigValue(config.value, config.valueType),
    ]));
  }

  @Put()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Persist a batch of validated system parameters' })
  async updateAllConfigs(
    @Body() body: Record<string, any>,
    @CurrentUser() user: RequestUser,
  ) {
    if (!(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Platform super-administrator permission is required to update global system parameters');
    }
    const entries = Object.entries(body || {});
    if (entries.length === 0) throw new BadRequestException('At least one configuration value is required');

    const allowedKeys = new Set<string>(Object.values(SystemConfigKey));
    const prepared = entries.map(([key, value]) => {
      if (!allowedKeys.has(key)) throw new BadRequestException('Unsupported system configuration key: ' + key);
      if (value === undefined) throw new BadRequestException('Configuration value cannot be undefined: ' + key);
      let valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
      if (typeof value === 'boolean') valueType = 'BOOLEAN';
      else if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new BadRequestException('Configuration number must be finite: ' + key);
        valueType = 'NUMBER';
      } else if (value !== null && typeof value === 'object') valueType = 'JSON';
      else valueType = 'STRING';
      return { key: key as SystemConfigKey, value, valueType };
    });

    await Promise.all(prepared.map((entry) =>
      this.systemConfigService.setValue(entry.key, entry.value, entry.valueType),
    ));
    return { success: true, updatedCount: prepared.length, updatedKeys: prepared.map((entry) => entry.key) };
  }

  @Get('public')
  @ApiOperation({ summary: 'Get all public configurations' })
  async getPublicConfigs() {
    return this.systemConfigService.getAllPublicConfigs();
  }

  @Get('numbering')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get persisted numbering formats and current-period counters' })
  async getNumberingSeries() {
    const formats = await this.prisma.numberingFormat.findMany({ orderBy: { entityType: 'asc' } });
    if (formats.length === 0) return [];

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const sequences = await this.prisma.numberingSequence.findMany({
      where: {
        entityType: { in: formats.map((format) => format.entityType) },
        year,
        month,
      },
    });
    const sequenceByEntity = new Map(sequences.map((row) => [row.entityType, row.sequence]));
    const periodLabel = year + '-' + String(month).padStart(2, '0');

    return formats.map((format) => {
      const currentSequence = sequenceByEntity.get(format.entityType) || 0;
      const nextSequence = String(currentSequence + 1).padStart(format.padding, '0');
      const previewSample = format.format
        .replaceAll('{PREFIX}', format.prefix)
        .replaceAll('{YYYY}', String(year))
        .replaceAll('{MM}', String(month).padStart(2, '0'))
        .replaceAll('{SEQUENCE}', nextSequence);
      return {
        id: format.entityType,
        entityType: format.entityType,
        prefix: format.prefix,
        format: format.format,
        padding: format.padding,
        currentSequence,
        periodLabel,
        previewSample,
      };
    });
  }

  @Put('numbering/:entityType')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create or update a global numbering format' })
  async updateNumberingFormat(
    @Param('entityType') entityTypeParam: string,
    @Body() dto: UpdateNumberingFormatDto,
    @CurrentUser() user: RequestUser,
  ) {
    // Numbering formats are global in the current schema, so only platform administrators may change them.
    if (!(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Platform super-administrator permission is required to change global numbering formats');
    }
    const entityType = entityTypeParam.trim().toUpperCase();
    if (!/^[A-Z][A-Z0-9_]{1,39}$/.test(entityType)) {
      throw new BadRequestException('Invalid entity type for numbering format');
    }
    const allowedTokens = new Set(['PREFIX', 'YYYY', 'MM', 'SEQUENCE']);
    const usedTokens = dto.format.match(/\{[^}]+\}/g) || [];
    if (!dto.format.includes('{PREFIX}') || !dto.format.includes('{SEQUENCE}') ||
        usedTokens.some((token) => !allowedTokens.has(token.slice(1, -1)))) {
      throw new BadRequestException('Format must include {PREFIX} and {SEQUENCE}; allowed placeholders are {PREFIX}, {YYYY}, {MM}, and {SEQUENCE}');
    }
    return this.prisma.numberingFormat.upsert({
      where: { entityType },
      create: { entityType, prefix: dto.prefix.trim(), format: dto.format.trim(), padding: dto.padding },
      update: { prefix: dto.prefix.trim(), format: dto.format.trim(), padding: dto.padding },
    });
  }

  @Get('metrics')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get admin system metrics' })
  async getAdminMetrics(@CurrentUser() user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }
    const [activeUsers, totalPoliciesCount, documentsCount] = await Promise.all(
      [
        this.prisma.user.count({ where: { companyId, status: 'ACTIVE' } }),
        this.prisma.policy.count({ where: { companyId } }),
        this.prisma.document.count({
          where: { deletedAt: null, uploadedBy: { companyId } },
        }),
      ],
    );
    return {
      activeUsers,
      storageUsedGb: Math.round(documentsCount * 0.005 * 10) / 10,
      totalPoliciesCount,
      activeJobsCount: 0,
    };
  }

  @Get('flags')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get persisted feature flags' })
  async getFeatureFlags() {
    const flags = await this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return flags.map((flag) => ({
      id: flag.key,
      key: flag.key,
      name: flag.key,
      environment: 'GLOBAL',
      description: flag.description || '',
      isEnabled: flag.isEnabled,
      updatedAt: flag.updatedAt,
    }));
  }

  @Patch('flags/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Persist a feature flag change' })
  async updateFeatureFlag(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureFlagDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Platform super-administrator permission is required to change global feature flags');
    }
    const current = await this.prisma.featureFlag.findUnique({ where: { key: id } });
    if (!current) throw new NotFoundException('Feature flag ' + id + ' is not configured');
    return this.prisma.featureFlag.update({
      where: { key: id },
      data: { isEnabled: dto.isEnabled },
    });
  }

  @Get(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get a specific configuration' })
  async getConfig(@Param('key') key: string, @CurrentUser() user: RequestUser) {
    if (!Object.values(SystemConfigKey).includes(key as SystemConfigKey)) {
      throw new BadRequestException('Invalid configuration key');
    }
    const configKey = key as SystemConfigKey;
    const record = await this.prisma.systemConfig.findUnique({ where: { key } });
    if (!record) throw new NotFoundException('Configuration key ' + key + ' is not configured');
    if (!record.isPublic && !(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Platform super-administrator permission is required to read this configuration');
    }
    return { key, value: this.parseConfigValue(record.value, record.valueType), valueType: record.valueType };
  }

  @Put(':key')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Persist a specific configuration' })
  async updateConfig(
    @Param('key') key: string,
    @Body() dto: UpdateConfigDto,
    @CurrentUser() user: RequestUser,
  ) {
    if (!Object.values(SystemConfigKey).includes(key as SystemConfigKey)) {
      throw new BadRequestException('Invalid configuration key');
    }
    if (!(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Platform super-administrator permission is required to update global system parameters');
    }
    const configKey = key as SystemConfigKey;
    await this.systemConfigService.setValue(configKey, dto.value, dto.valueType);
    return { success: true, key, value: dto.value, valueType: dto.valueType };
  }

  private parseConfigValue(value: string, valueType: string): any {
    switch (valueType) {
      case 'NUMBER': return Number(value);
      case 'BOOLEAN': return value === 'true';
      case 'JSON': return JSON.parse(value);
      default: return value;
    }
  }
}
