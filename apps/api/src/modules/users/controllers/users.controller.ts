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
  @Roles(RoleType.ADMIN)
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
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
  @ApiOperation({ summary: 'Change current user password' })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() dto: { currentPassword?: string; newPassword: string },
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
  ) {
    return this.usersService.findAll(pagination, status);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/status')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update user status with state machine validation' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { status: UserStatus; reason?: string },
    @CurrentUser() actor: RequestUser,
  ) {
    return this.usersService.updateStatus(id, dto.status, dto.reason, actor?.id);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update user profile, role, or branch assignment' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Soft delete / offboard user account' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.delete(id);
  }

  @Post(':id/lock')
  @Roles(RoleType.ADMIN)
  lock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.lockUser(id, actor?.id);
  }

  @Post(':id/unlock')
  @Roles(RoleType.ADMIN)
  unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() actor: RequestUser) {
    return this.usersService.unlockUser(id, actor?.id);
  }

  @Post(':id/reset-password')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Admin reset user password' })
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { newPassword?: string },
  ) {
    return this.usersService.adminResetPassword(id, dto.newPassword);
  }
}
