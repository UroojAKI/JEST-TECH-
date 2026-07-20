import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateAccountDto } from '../dto/create-account.dto';
import { UpdateAccountDto } from '../dto/update-account.dto';
import { AccountsService } from '../services/accounts.service';

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: RequestUser) {
    return this.accountsService.create(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findAll() {
    return this.accountsService.findAll();
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  findOne(@Param('id') id: string) {
    return this.accountsService.findById(id);
  }

  @Patch(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.accountsService.update(id, dto, user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.accountsService.remove(id, user.id);
  }
}
