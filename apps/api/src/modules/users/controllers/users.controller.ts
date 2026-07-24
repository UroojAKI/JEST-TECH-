import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

import { CreateUserDto } from '../dto/create-user.dto';
import { UsersService } from '../services/users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleType.SUPER_ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
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

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Post(':id/lock')
  lock(@Param('id') id: string) {
    return this.usersService.lockUser(id);
  }

  @Post(':id/unlock')
  unlock(@Param('id') id: string) {
    return this.usersService.unlockUser(id);
  }
}

