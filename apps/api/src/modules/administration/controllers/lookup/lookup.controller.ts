import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Put,
  Delete,
  Body,
} from '@nestjs/common';
import { LookupService } from '../../services/lookup/lookup.service';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@ApiTags('Administration - Lookups')
@Controller('admin/lookups')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all active lookup categories and values' })
  async getAllLookups() {
    return this.lookupService.getAll();
  }

  @Get(':categoryCode')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get hierarchical lookups by category' })
  async getLookupsByCategory(@Param('categoryCode') categoryCode: string) {
    return this.lookupService.getByCategory(categoryCode);
  }

  @Post(':categoryCode/values')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create lookup value in category' })
  async createLookupValue(
    @Param('categoryCode') categoryCode: string,
    @Body()
    dto: {
      code: string;
      name: string;
      description?: string;
      parentId?: string;
      orderIndex?: number;
    },
  ) {
    return this.lookupService.createValue(categoryCode, dto);
  }

  @Put(':categoryCode/values/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update lookup value in category' })
  async updateLookupValue(
    @Param('categoryCode') categoryCode: string,
    @Param('id') id: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      isActive?: boolean;
      orderIndex?: number;
    },
  ) {
    return this.lookupService.updateValue(categoryCode, id, dto);
  }

  @Delete(':categoryCode/values/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Deactivate lookup value in category' })
  async deleteLookupValue(
    @Param('categoryCode') categoryCode: string,
    @Param('id') id: string,
  ) {
    return this.lookupService.deleteValue(categoryCode, id);
  }

  @Post(':categoryCode/invalidate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Invalidate cache for a lookup category' })
  async invalidateCache(@Param('categoryCode') categoryCode: string) {
    await this.lookupService.invalidateCache(categoryCode);
    return { success: true };
  }
}
