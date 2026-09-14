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

import {
  CurrentUser,
  RequestUser,
} from '../../../auth/decorators/current-user.decorator';

const HIERARCHY_VIEW_ROLES = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.MD_CEO,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.BRANCH_MANAGER,
  RoleType.OPERATIONS,
  RoleType.FINANCE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
];

const BRANCH_VIEW_ROLES = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.MD_CEO,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.BRANCH_MANAGER,
  RoleType.OPERATIONS,
  RoleType.FINANCE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_EXECUTIVE,
  RoleType.SALES_AGENT,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.UNDERWRITER,
  RoleType.CLAIMS_OFFICER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.SUPPORT,
];

const DEPT_VIEW_ROLES = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.MD_CEO,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.BRANCH_MANAGER,
  RoleType.OPERATIONS,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.AGENT_MANAGER,
];

class AssignTeamDto {
  userId: string;
  teamId: string;
}

class CreateBranchDto {
  name: string;
  code: string;
  city: string;
  state?: string;
  address?: string;
  zoneId?: string;
}

@ApiTags('Administration - Organization')
@Controller('admin/organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('hierarchy')
  @Roles(...HIERARCHY_VIEW_ROLES)
  @ApiOperation({ summary: 'Get full organization hierarchy' })
  async getHierarchy(@CurrentUser() user: RequestUser) {
    return this.organizationService.getHierarchy(user);
  }

  @Get('branches')
  @Roles(...BRANCH_VIEW_ROLES)
  @ApiOperation({ summary: 'Get all branches' })
  async getBranches(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getBranches(pagination, user);
  }

  @Post('branches')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Create a new branch' })
  async createBranch(
    @Body() dto: CreateBranchDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.createBranch(dto, user);
  }

  @Get('branches/:branchId/departments')
  @Roles(...DEPT_VIEW_ROLES)
  @ApiOperation({ summary: 'Get departments for a branch' })
  async getDepartments(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getDepartments(pagination, branchId, user);
  }

  @Get('departments/:departmentId/teams')
  @Roles(...DEPT_VIEW_ROLES)
  @ApiOperation({ summary: 'Get teams for a department' })
  async getTeams(
    @Param('departmentId', ParseUUIDPipe) departmentId: string,
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.organizationService.getTeams(pagination, departmentId, user);
  }

  @Post('assign-team')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
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
