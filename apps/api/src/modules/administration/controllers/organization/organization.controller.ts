import { Controller, Get, Param, UseGuards, Post, Body, Query } from '@nestjs/common';
import { OrganizationService } from '../../services/organization/organization.service';
import { PaginationDto } from '../../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../../common/utils/parse-uuid.pipe';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

class AssignTeamDto {
  userId: string;
  teamId: string;
}

@ApiTags('Administration - Organization')
@Controller('admin/organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get full organization hierarchy' })
  async getHierarchy() {
    return this.organizationService.getHierarchy();
  }

  @Get('branches')
  @ApiOperation({ summary: 'Get all branches' })
  async getBranches(@Query() pagination: PaginationDto) {
    return this.organizationService.getBranches(pagination);
  }

  @Get('branches/:branchId/departments')
  @ApiOperation({ summary: 'Get departments for a branch' })
  async getDepartments(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.organizationService.getDepartments(pagination, branchId);
  }

  @Get('departments/:departmentId/teams')
  @ApiOperation({ summary: 'Get teams for a department' })
  async getTeams(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() pagination: PaginationDto,
  ) {
    return this.organizationService.getTeams(pagination, departmentId);
  }

  @Post('assign-team')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Assign a user to a team' })
  async assignTeam(@Body() dto: AssignTeamDto) {
    return this.organizationService.assignUserToTeam(dto.userId, dto.teamId);
  }
}
