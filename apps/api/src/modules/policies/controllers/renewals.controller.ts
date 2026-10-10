import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';
import { ScopeResolver } from '../../../common/services/scope-resolver.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { RenewalEngineService } from '../services/renewal-engine.service';

@ApiTags('Renewals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('renewals')
export class RenewalsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scopeResolver: ScopeResolver,
    private readonly numberingEngine: NumberingEngineService,
    private readonly renewalEngine: RenewalEngineService,
  ) {}

  @Get('tasks')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({
    summary: 'Get paginated renewal tasks scoped by tenancy and role',
  })
  async getRenewalTasks(
    @Query('urgencyDays') urgencyDays?: number,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @CurrentUser() user?: RequestUser,
  ) {
    const p = Math.max(1, Number(page) || 1);
    const l = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (p - 1) * l;

    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );

    let dueDateFilter: any = {};
    if (urgencyDays !== undefined && !isNaN(Number(urgencyDays))) {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + Number(urgencyDays));
      dueDateFilter = { dueDate: { lte: targetDate } };
    }

    const effectiveCompanyId = user?.companyId || (user as any)?.organizationId;
    const where: any = {
      ...(effectiveCompanyId ? { policy: { companyId: effectiveCompanyId } } : {}),
      ...scopedFilter,
      ...(status && status !== 'ALL' ? { status } : {}),
      ...dueDateFilter,
    };

    const [items, total] = await Promise.all([
      this.prisma.renewalTask.findMany({
        where,
        skip,
        take: l,
        include: {
          policy: {
            include: { contact: true, quotation: true },
          },
        },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.renewalTask.count({ where }),
    ]);

    return {
      items,
      meta: {
        page: p,
        limit: l,
        total,
        totalPages: Math.ceil(total / l) || 1,
      },
    };
  }

  @Post('tasks/:id/quote')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Create renewal quote linked to policy and task' })
  async createRenewalQuote(
    @Param('id') taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const task = await this.prisma.renewalTask.findUnique({
      where: { id: taskId },
      include: { policy: { include: { quotation: true } } },
    });
    if (!task) {
      throw new NotFoundException(`Renewal task with ID ${taskId} not found`);
    }

    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const accessible = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!accessible) {
      throw new ForbiddenException('Access to this renewal task is denied');
    }

    const existingQuote = task.policy.quotation;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    const quotationCode = await this.numberingEngine.generateNext(
      'QUOTATION',
      this.prisma,
    );

    // Calculate authoritative renewal parameters derived from IRDAI rating config & statutory depreciation:
    const prevSumInsured = Number(
      existingQuote?.sumInsured || task.policy.premiumAmount || 500000,
    );
    const prevBasePrem = Number(
      existingQuote?.basePremium || task.policy.premiumAmount || 10000,
    );
    const prevNcb = Number(existingQuote?.ncbPercentage || 0);

    const vehicleMeta = (task.policy.motorMetadata as Record<string, any>) || {};
    const regYear = Number(vehicleMeta.registrationYear || vehicleMeta.manufacturingYear || (new Date().getFullYear() - 1));
    const vehicleAgeYears = Math.max(1, new Date().getFullYear() - regYear);

    const claimsCount = await this.prisma.claim.count({
      where: { policyId: task.policyId, companyId: task.policy.companyId },
    });
    const hasClaims = claimsCount > 0;

    const pricing = this.renewalEngine.calculateRenewalPricing({
      prevSumInsured,
      prevBasePremium: prevBasePrem,
      prevNcb,
      hasClaims,
      vehicleAgeYears,
    });

    const revisedIdv = pricing.revisedIdv;
    const nextNcb = pricing.nextNcb;
    const revisedBase = pricing.revisedBase;
    const gstAmount = pricing.gstAmount;
    const totalPremium = pricing.totalPremium;

    const renewalQuote = await this.prisma.quotation.create({
      data: {
        title: `Renewal Quote - ${task.policy.policyNumber}`,
        quotationCode,
        status: 'DRAFT',
        companyId: task.policy.companyId,
        contactId: task.policy.contactId,
        accountId: task.policy.accountId,
        leadId: existingQuote?.leadId || null,
        agentId: user.agentId || task.agentId || null,
        createdById: user.id,
        insurerName: existingQuote?.insurerName || 'Partner Insurer',
        productType: existingQuote?.productType || 'MOTOR',
        sumInsured: revisedIdv,
        basePremium: revisedBase,
        gstAmount,
        totalPremium,
        ncbPercentage: nextNcb,
        calculationSnapshot: {
          revisedIdv,
          revisedBase,
          gstAmount,
          totalPremium,
          ncbPercentage: nextNcb,
          depreciationApplied: `${pricing.depreciationPercentage}%`,
          calculatedAt: new Date().toISOString(),
        },
        calculationVersion: 'RENEWAL_V2',
        expiryDate: expiry,
      },
    });

    return {
      success: true,
      renewalTaskId: taskId,
      quotation: renewalQuote,
    };
  }

  @Post('tasks/:id/complete')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Transition renewal task to COMPLETED' })
  async completeTask(
    @Param('id') taskId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const task = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!task) {
      throw new NotFoundException(
        `Renewal task with ID ${taskId} not found or access denied`,
      );
    }
    const updated = await this.prisma.renewalTask.update({
      where: { id: taskId },
      data: { status: 'COMPLETED' },
    });
    return { success: true, task: updated };
  }

  @Post('tasks/:id/lost')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Transition renewal task to LOST/CANCELLED' })
  async markTaskLost(
    @Param('id') taskId: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: RequestUser,
  ) {
    const scopedFilter = this.scopeResolver.resolveScopeFilter(
      user as any,
      'RENEWAL_TASK',
    );
    const task = await this.prisma.renewalTask.findFirst({
      where: { id: taskId, ...scopedFilter },
    });
    if (!task) {
      throw new NotFoundException(
        `Renewal task with ID ${taskId} not found or access denied`,
      );
    }
    const updated = await this.prisma.renewalTask.update({
      where: { id: taskId },
      data: { status: 'CANCELLED' },
    });
    return { success: true, task: updated, reason: dto?.reason };
  }
}
