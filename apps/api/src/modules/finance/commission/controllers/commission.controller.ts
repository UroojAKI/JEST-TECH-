import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CommissionEngineService } from '../services/commission-engine/commission-engine.service';

@ApiTags('Finance Commissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance/commissions')
export class CommissionController {
  constructor(
    private readonly commissionEngineService: CommissionEngineService,
  ) {}

  @Post('accrue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.FINANCE,
    RoleType.BRANCH_MANAGER,
  )
  @ApiOperation({
    summary: 'Calculate and accrue commission structure for a policy',
  })
  async accrue(
    @Body()
    dto: {
      policyId: string;
      agentId: string;
      premiumAmount: string;
      planId: string;
    },
  ) {
    return this.commissionEngineService.accrueCommissions(
      dto.policyId,
      dto.agentId,
      dto.premiumAmount,
      dto.planId,
    );
  }

  @Post('realize/:policyId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  @ApiOperation({
    summary:
      'Mark accrued commissions as realized upon policy payment confirmation',
  })
  async realize(@Param('policyId') policyId: string) {
    const count =
      await this.commissionEngineService.realizeCommissions(policyId);
    return { status: 'success', realizedCount: count };
  }
}
