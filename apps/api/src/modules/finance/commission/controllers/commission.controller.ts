import { BadRequestException, Body, Controller, ForbiddenException, Get, NotFoundException, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { RequirePermissions } from '../../../auth/decorators/permissions.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { UpsertCommissionPlanDto } from '../commission-plan.dto';
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
    private readonly prisma: PrismaService,
  ) {}

  @Get('plans')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('commission:read')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List persisted commission plans and approved rule caps' })
  async getPlans() {
    const plans = await this.prisma.commissionPlan.findMany({
      orderBy: { updatedAt: 'desc' },
    });
    return plans.map((plan) => {
      let rules: unknown = null;
      let rulesStatus = 'VALID';
      try {
        rules = JSON.parse(plan.rules);
      } catch {
        rulesStatus = 'INVALID';
      }
      return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        isActive: plan.isActive,
        rules,
        rulesStatus,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      };
    });
  }

  @Post('plans')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('commission:configure')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create a validated global commission plan' })
  async createPlan(
    @Body() dto: UpsertCommissionPlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertPlatformPlanAdmin(user);
    const rules = this.normalizePlanRules(dto);
    return this.prisma.commissionPlan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        rules: JSON.stringify(rules),
        isActive: true,
      },
    });
  }

  @Put('plans/:id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('commission:configure')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update a global commission plan and its approval caps' })
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpsertCommissionPlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertPlatformPlanAdmin(user);
    const existing = await this.prisma.commissionPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Commission plan not found');
    const rules = this.normalizePlanRules(dto);
    return this.prisma.commissionPlan.update({
      where: { id },
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        rules: JSON.stringify(rules),
      },
    });
  }

  @Patch('plans/:id/toggle')
  @UseGuards(PermissionsGuard)
  @RequirePermissions('commission:configure')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Activate or deactivate a commission plan' })
  async togglePlan(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    this.assertPlatformPlanAdmin(user);
    const existing = await this.prisma.commissionPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Commission plan not found');
    return this.prisma.commissionPlan.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
  }

  private assertPlatformPlanAdmin(user: RequestUser) {
    if (!(user as any).permissions?.includes('*')) {
      throw new ForbiddenException('Commission plans are global in the current data model and can only be changed by a platform super-administrator.');
    }
  }

  private normalizePlanRules(dto: UpsertCommissionPlanDto) {
    const agentPercent = Number(dto.agentPercent);
    const maxAgentPercent = Number(dto.maxAgentPercent);
    const maxTotalPercent = Number(dto.maxTotalPercent);
    const overrides = dto.overrides || [];
    for (const [key, value] of Object.entries({ agentPercent, maxAgentPercent, maxTotalPercent })) {
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        throw new BadRequestException(key + ' must be between 0 and 100');
      }
    }
    if (agentPercent > maxAgentPercent) {
      throw new BadRequestException('agentPercent cannot exceed maxAgentPercent');
    }
    let totalPercent = agentPercent;
    for (const override of overrides) {
      if (!override.userId?.trim() || !override.roleTier?.trim()) {
        throw new BadRequestException('Each manager override requires a userId and roleTier');
      }
      const percent = Number(override.percent);
      if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new BadRequestException('Every override percentage must be between 0 and 100');
      }
      totalPercent += percent;
    }
    if (totalPercent > maxTotalPercent) {
      throw new BadRequestException('Agent plus manager override percentages exceed maxTotalPercent');
    }
    return { agentPercent, maxAgentPercent, maxTotalPercent, overrides };
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
  ) {
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
  async realize(@Param('policyId') policyId: string) {
    const count =
      await this.commissionEngineService.realizeCommissions(policyId);
    return { status: 'success', realizedCount: count };
  }
}
