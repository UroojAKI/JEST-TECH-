import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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

import { CreatePolicyDto } from '../dto/create-policy.dto';
import { RenewPolicyDto } from '../dto/renew-policy.dto';

import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { CancelPolicyService } from '../services/commands/cancel-policy.service';
import { RenewPolicyService } from '../services/commands/renew-policy.service';

import { GetPolicyService } from '../services/queries/get-policy.service';
import { GetPolicyHistoryService } from '../services/queries/get-policy-history.service';

@ApiTags('Policies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(
    private readonly issuePolicyService: IssuePolicyService,
    private readonly cancelPolicyService: CancelPolicyService,
    private readonly renewPolicyService: RenewPolicyService,
    private readonly getPolicyService: GetPolicyService,
    private readonly getPolicyHistoryService: GetPolicyHistoryService,
  ) {}

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  create(
    @Body() dto: CreatePolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.issuePolicyService.execute(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE,
    RoleType.SUPPORT,
  )
  findAll(@CurrentUser() user: RequestUser) {
    return this.getPolicyService.executeAll(user);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE,
    RoleType.SUPPORT,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.getPolicyService.executeOne(id, user);
  }

  @Get(':id/history')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
  )
  getHistory(@Param('id') id: string) {
    return this.getPolicyHistoryService.execute(id);
  }

  @Post(':id/renew')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  renew(
    @Param('id') id: string,
    @Body() dto: RenewPolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.renewPolicyService.execute(id, dto, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  cancel(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cancelPolicyService.execute(id, comments, user.id);
  }
}
