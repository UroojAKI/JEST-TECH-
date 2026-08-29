import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';

import { OrganizationService } from '../services/organization.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  CreateJobRoleDto,
  UpdateJobRoleDto,
} from '../dto/organization.dto';

@ApiTags('Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get('departments')
  @ApiOperation({ summary: 'Get all organization departments' })
  getDepartments(@Query() pagination: PaginationDto) {
    return this.organizationService.getDepartments(pagination);
  }

  @Get('departments/:id')
  @ApiOperation({ summary: 'Get department details' })
  getDepartmentById(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getDepartmentById(id);
  }

  @Post('departments')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Create new department' })
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.organizationService.createDepartment(dto);
  }

  @Put('departments/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update department' })
  updateDepartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDepartmentDto,
  ) {
    return this.organizationService.updateDepartment(id, dto);
  }

  @Delete('departments/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Delete department' })
  deleteDepartment(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.deleteDepartment(id);
  }

  @Get('job-roles')
  @ApiOperation({ summary: 'Get all job roles' })
  getJobRoles(@Query() pagination: PaginationDto) {
    return this.organizationService.getJobRoles(pagination);
  }

  @Get('job-roles/:id')
  @ApiOperation({ summary: 'Get job role details' })
  getJobRoleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.getJobRoleById(id);
  }

  @Post('job-role')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Create new job role' })
  createJobRole(@Body() dto: CreateJobRoleDto) {
    return this.organizationService.createJobRole(dto);
  }

  @Put('job-role/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update job role' })
  updateJobRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobRoleDto,
  ) {
    return this.organizationService.updateJobRole(id, dto);
  }

  @Delete('job-role/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Delete job role' })
  deleteJobRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationService.deleteJobRole(id);
  }

  @Get('hierarchy')
  @ApiOperation({ summary: 'Get full organization hierarchy tree' })
  getHierarchy() {
    return this.organizationService.getHierarchy();
  }
}
