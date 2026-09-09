import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { Customer360Service } from './customer-360.service';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { RoleType } from '@prisma/client';

@Controller('customer-360')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(
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
)
export class Customer360Controller {
  constructor(private readonly customer360Service: Customer360Service) {}

  @Get(':id')
  async getCustomer360(@Param('id') id: string) {
    return this.customer360Service.getCustomer360(id);
  }
}
