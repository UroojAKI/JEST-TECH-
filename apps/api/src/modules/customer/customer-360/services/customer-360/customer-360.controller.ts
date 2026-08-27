import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
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
  RoleType.BRANCH_MANAGER,
  RoleType.SALES_AGENT,
  RoleType.RELATIONSHIP_MANAGER,
  RoleType.UNDERWRITER,
  RoleType.FINANCE,
)
export class Customer360Controller {
  constructor(private readonly customer360Service: Customer360Service) {}

  @Get(':id')
  async getCustomer360(@Param('id') id: string) {
    return this.customer360Service.getCustomer360(id);
  }
}
