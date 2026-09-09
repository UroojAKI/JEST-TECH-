import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
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
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

const ACCOUNT_VIEW_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.CLAIMS_OFFICER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.FINANCE,
  RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.SUPPORT,
];

const ACCOUNT_MANAGE_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.SYSTEM_ADMINISTRATOR,
  RoleType.MD_CEO,
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  RoleType.SUPPORT,
];

@ApiTags('Accounts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @Roles(...ACCOUNT_MANAGE_ROLES)
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: RequestUser) {
    return this.accountsService.create(dto, user.id, user);
  }

  @Get()
  @Roles(...ACCOUNT_VIEW_ROLES)
  findAll(@Query() pagination: PaginationDto, @CurrentUser() user: RequestUser) {
    return this.accountsService.findAll(pagination, user);
  }

  @Get(':id')
  @Roles(...ACCOUNT_VIEW_ROLES)
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.accountsService.findById(id, user);
  }

  @Post(':id/unmask')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.SYSTEM_ADMINISTRATOR,
    RoleType.MD_CEO,
    RoleType.BRANCH_MANAGER,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
    RoleType.FINANCE,
    RoleType.CHIEF_FINANCE_OFFICER,
  )
  unmask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.accountsService.unmask(id, reason, user);
  }

  @Patch(':id')
  @Roles(...ACCOUNT_MANAGE_ROLES)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccountDto, @CurrentUser() user: RequestUser) {
    return this.accountsService.update(id, dto, user.id, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.SYSTEM_ADMINISTRATOR, RoleType.MD_CEO)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.accountsService.remove(id, user.id, user);
  }
}