import { Body, Controller, Get, Param, Post, Patch, UseGuards, ForbiddenException } from '@nestjs/common';
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

  @Get('plans')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List commission plans configured for the authenticated company' })
  async listPlans(@CurrentUser() actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required');
    return this.commissionEngineService.listCommissionPlans(companyId);
  }

  @Post('plans')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create a tenant-owned commission plan' })
  async createPlan(
    @Body() dto: { name: string; description?: string; rules: { agentPercent: number; overrides?: Array<{ roleTier: string; percent: number; userId: string }>; accounting: { expenseAccountId: string; payableAccountId: string } } },
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required');
    return this.commissionEngineService.createCommissionPlan(companyId, dto);
  }

  @Patch('plans/:id')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update or deactivate a tenant-owned commission plan' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; rules?: { agentPercent: number; overrides?: Array<{ roleTier: string; percent: number; userId: string }> }; isActive?: boolean },
    @CurrentUser() actor: RequestUser,
  ) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required');
    return this.commissionEngineService.updateCommissionPlan(companyId, id, dto);
  }

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
      companyId,
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
