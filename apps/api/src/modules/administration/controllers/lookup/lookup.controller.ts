import { Controller, Get, Param, UseGuards, Post, Body } from '@nestjs/common';
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

  @Get(':categoryCode')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get hierarchical lookups by category' })
  async getLookupsByCategory(@Param('categoryCode') categoryCode: string) {
    return this.lookupService.getByCategory(categoryCode);
  }

  @Post(':categoryCode/invalidate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Invalidate cache for a lookup category' })
  async invalidateCache(@Param('categoryCode') categoryCode: string) {
    await this.lookupService.invalidateCache(categoryCode);
    return { success: true };
  }
}
