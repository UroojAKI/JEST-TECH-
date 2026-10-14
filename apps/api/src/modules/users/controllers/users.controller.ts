import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType, UserStatus } from '@prisma/client';

import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AnyAuthenticatedRole } from '../../auth/decorators/any-authenticated.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';
import { ChangePasswordDto } from '../dto/change-password.dto';
import { UpdateUserStatusDto } from '../dto/update-user-status.dto';
import { AdminResetPasswordDto } from '../dto/admin-reset-password.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(RoleType.ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: RequestUser) {
    return this.usersService.create(dto, actor);
  }

  @Get('roles')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Get all available canonical system roles' })
  async getAvailableRoles() {
    return [
      {
        id: 'ADMIN',
        name: 'Administrator',
        description: 'System & business administration, tenant governance',
      },
      {
        id: 'BACK_OFFICE',
        name: 'Back Office Operations',
        description: 'Operations, underwriting, claims, finance, renewals',
      },
      {
        id: 'AGENT',
        name: 'Insurance Agent',
        description: 'Customer-facing sales, field work, lead acquisition',
      },
    ];
  }

  @Post('change-password')
  @AnyAuthenticatedRole()
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
    );
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  findAll(
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.usersService.findAll(pagination, status, actor);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.usersService.findById(id, actor);
  }

  @Patch(':id/status')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update user status with state machine validation' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateStatus(
      id,
      dto.status,
      dto.reason,
      actor?.id,
      actor,
    );
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update user profile, role, or branch assignment' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.usersService.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Soft delete / offboard user account' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.usersService.delete(id, actor);
  }

  @Post(':id/lock')
  @Roles(RoleType.ADMIN)
  lock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.lockUser(id, actor?.id);
  }

  @Post(':id/unlock')
  @Roles(RoleType.ADMIN)
  unlock(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.unlockUser(id, actor?.id);
  }

  @Post(':id/reset-password')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Admin reset user password' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @CurrentUser() actor?: RequestUser,
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword, actor);
  }
}
