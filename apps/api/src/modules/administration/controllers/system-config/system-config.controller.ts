import {
  Controller,
  Get,
  Put,
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

  @Get('public')
  @ApiOperation({ summary: 'Get all public configurations' })
  async getPublicConfigs() {
    return this.systemConfigService.getAllPublicConfigs();
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
    const value = await this.systemConfigService.getValue(key);
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
    await this.systemConfigService.setValue(key, dto.value, dto.valueType);
    return { success: true, key };
  }
}
