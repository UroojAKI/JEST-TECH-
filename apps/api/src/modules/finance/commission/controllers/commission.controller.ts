import { Body, Controller, Get, Param, Post, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
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
    RoleType.ADMIN,
    RoleType.ADMIN,
    RoleType.BACK_OFFICE,
    RoleType.BACK_OFFICE,
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
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required');
    return this.commissionEngineService.accrueCommissions(
      dto.policyId,
      dto.agentId,
      dto.premiumAmount,
      dto.planId,
    );
  }

  @Post('realize/:policyId')
  @Roles(RoleType.ADMIN, RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary:
      'Mark accrued commissions as realized upon policy payment confirmation',
  })
  async realize(
    @Param('policyId') policyId: string,
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required');
    const count =
      await this.commissionEngineService.realizeCommissions(policyId, companyId);
    return { status: 'success', realizedCount: count };
  }
}
