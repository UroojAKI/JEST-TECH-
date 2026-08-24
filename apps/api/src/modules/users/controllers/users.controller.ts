import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Get('roles')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Get all available system roles' })
  async getAvailableRoles() {
    return [
      { id: 'SUPER_ADMIN', name: 'Super Administrator', description: 'Full system access' },
      { id: 'ADMIN', name: 'Administrator', description: 'Branch and user management' },
      { id: 'BRANCH_MANAGER', name: 'Branch Manager', description: 'Branch operations oversight' },
      { id: 'UNDERWRITER', name: 'Underwriter', description: 'Policy underwriting and approval' },
      { id: 'SALES_AGENT', name: 'Sales Agent', description: 'Lead and policy sales' },
      { id: 'FINANCE', name: 'Finance Officer', description: 'Financial operations' },
      { id: 'CLAIMS_OFFICER', name: 'Claims Officer', description: 'Claims processing and settlement' },
    ];
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: { currentPassword?: string; newPassword: string },
  ) {
    return this.usersService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.UNDERWRITER,
    RoleType.OPERATIONS,
  )
  findAll(@Query() pagination: PaginationDto) {
    return this.usersService.findAll(pagination);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Update user profile, role, or branch assignment' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Soft delete / offboard user account' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/lock')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  lock(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.lockUser(id);
  }

  @Post(':id/unlock')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  unlock(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.unlockUser(id);
  }

  @Post(':id/reset-password')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  @ApiOperation({ summary: 'Admin reset user password' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { newPassword?: string },
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword);
  }
}
