import {
  Controller,
  Get,
  Param,
  UseGuards,
  Post,
  Body,
  Query,
} from '@nestjs/common';
import { OrganizationService } from '../../services/organization/organization.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../../common/utils/parse-uuid.pipe';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

import {
  CurrentUser,
  RequestUser,
} from '../../../auth/decorators/current-user.decorator';

export class AssignTeamDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;
}

@ApiTags('Administration - Organization')
@Controller('admin/organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hierarchy')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get full organization hierarchy' })
  async getHierarchy(@CurrentUser() user: RequestUser) {
    return this.organizationService.getHierarchy(user);
  }

  @Get('branches')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get all branches' })
  async getBranches(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getBranches(pagination, user);
  }

  @Post('branches')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create a new branch' })
  async createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.createBranch(dto, user);
  }

  @Get('branches/:branchId/departments')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get departments for a branch' })
  async getDepartments(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getDepartments(pagination, branchId, user);
  }

  @Get('departments/:departmentId/teams')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get teams for a department' })
  async getTeams(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getTeams(pagination, departmentId, user);
  }

  @Post('assign-team')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Assign a user to a team' })
  async assignTeam(
    @Body() dto: AssignTeamDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.assignUserToTeam(
      dto.userId,
      dto.teamId,
      user,
    );
  }
}
