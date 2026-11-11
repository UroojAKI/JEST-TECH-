import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { LegacyPoliciesService } from '../services/legacy-policies.service';

@ApiTags('Legacy Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legacy-policies')
export class LegacyPoliciesController {
  constructor(private readonly legacyPolicies: LegacyPoliciesService) {}

  @Post()
  @Roles(RoleType.AGENT)
  @ApiOperation({ summary: 'Register an already-issued historical policy without creating quotation, payment or inspection records' })
  create(@Body() dto: any, @CurrentUser() user: RequestUser) {
    return this.legacyPolicies.create(dto, user);
  }

  @Get()
  @Roles(RoleType.AGENT)
  findAll(@CurrentUser() user: RequestUser) {
    return this.legacyPolicies.findAll(user);
  }

  @Get('renewals/upcoming')
  @Roles(RoleType.AGENT)
  upcoming(@CurrentUser() user: RequestUser) {
    return this.legacyPolicies.upcoming(user);
  }

  @Get(':id')
  @Roles(RoleType.AGENT)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.legacyPolicies.findOne(id, user);
  }
}
