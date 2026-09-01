import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

import { CreatePolicyDto } from '../dto/create-policy.dto';
import { RenewPolicyDto } from '../dto/renew-policy.dto';

import { CancelPolicyService } from '../services/commands/cancel-policy.service';
import { RenewPolicyService } from '../services/commands/renew-policy.service';

import { GetPolicyService } from '../services/queries/get-policy.service';
import { GetPolicyHistoryService } from '../services/queries/get-policy-history.service';
import { PrismaService } from '../../../database/prisma.service';

import { RenewalEngineService } from '../services/renewal-engine.service';
import { RenewalSchedulerCron } from '../crons/renewal-scheduler.cron';

import { IssuePolicyService } from '../services/commands/issue-policy.service';
import { BackOfficeQueueService } from '../services/queries/back-office-queue.service';
import { BadRequestException } from '@nestjs/common';

@ApiTags('Policies & Renewal Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('policies')
export class PoliciesController {
  constructor(
    private readonly cancelPolicyService: CancelPolicyService,
    private readonly renewPolicyService: RenewPolicyService,
    private readonly getPolicyService: GetPolicyService,
    private readonly getPolicyHistoryService: GetPolicyHistoryService,
    private readonly prisma: PrismaService,
    private readonly renewalEngineService: RenewalEngineService,
    private readonly renewalSchedulerCron: RenewalSchedulerCron,
    private readonly issuePolicyService: IssuePolicyService,
    private readonly backOfficeQueueService: BackOfficeQueueService,
  ) {}

  @Post('issue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.OPERATIONS,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  @ApiOperation({
    summary: 'Issue policy from quotation with validation gates',
  })
  async issuePolicyDirect(@Body() dto: any, @CurrentUser() user: RequestUser) {
    const quotationId = dto.quotationId || dto.quoteId;
    if (!quotationId) {
      throw new BadRequestException('quotationId is required to issue a policy.');
    }
    // Enforce all 5 authoritative gates (Customer KYC, Vehicle plate, Inspection, Payment, Documents) before issuance
    await this.backOfficeQueueService.validateIssuanceGates(quotationId);
    return this.issuePolicyService.execute(
      {
        quotationId,
        issueSource: dto.issueSource || 'DIRECT_ISSUANCE',
        ...dto,
      },
      user.id,
    );
  }

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.OPERATIONS,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  @ApiOperation({
    summary: 'Create policy from quotation or proposal with validation gates',
  })
  async createPolicyRoot(@Body() dto: any, @CurrentUser() user: RequestUser) {
    let quotationId = dto.quotationId || dto.quoteId;
    if (!quotationId && dto.proposalId) {
      const proposal = await this.prisma.proposal.findUnique({
        where: { id: dto.proposalId },
      });
      if (proposal?.quotationId) quotationId = proposal.quotationId;
    }
    if (!quotationId) {
      throw new BadRequestException('A valid quotationId or proposalId is required to create a policy.');
    }
    // Enforce all 5 authoritative gates (Customer KYC, Vehicle plate, Inspection, Payment, Documents) before issuance
    await this.backOfficeQueueService.validateIssuanceGates(quotationId);
    return this.issuePolicyService.execute(
      {
        quotationId,
        issueSource: 'POLICY_CONVERSION',
        ...dto,
      },
      user.id,
    );
  }

  @Get('renewals/kpis')
  @ApiOperation({ summary: 'Get Renewal Engine KPIs and Conversion Telemetry' })
  async getRenewalKpis(@CurrentUser() user: RequestUser) {
    const isManager =
      user.role === 'BRANCH_MANAGER' ||
      user.role === 'TEAM_LEADER' ||
      user.role === 'SUPER_ADMIN';

    const where: any = {};
    if (!isManager) where.agentId = user.id;

    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const endOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
    );

    const in7 = new Date(startOfToday);
    in7.setDate(in7.getDate() + 7);

    const in15 = new Date(startOfToday);
    in15.setDate(in15.getDate() + 15);

    const in30 = new Date(startOfToday);
    in30.setDate(in30.getDate() + 30);

    const [
      dueToday,
      in7Days,
      in15Days,
      in30Days,
      overdue,
      completedRenewals,
      totalTasks,
      completedTasks,
    ] = await Promise.all([
      this.prisma.renewalTask.count({
        where: {
          ...where,
          status: 'PENDING',
          dueDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.renewalTask.count({
        where: {
          ...where,
          status: 'PENDING',
          dueDate: { gte: startOfToday, lte: in7 },
        },
      }),
      this.prisma.renewalTask.count({
        where: { ...where, status: 'PENDING', dueDate: { gt: in7, lte: in15 } },
      }),
      this.prisma.renewalTask.count({
        where: {
          ...where,
          status: 'PENDING',
          dueDate: { gt: in15, lte: in30 },
        },
      }),
      this.prisma.renewalTask.count({
        where: { ...where, status: 'PENDING', dueDate: { lt: startOfToday } },
      }),
      this.prisma.policyRenewal.findMany({
        select: { premiumAmount: true },
        take: 100,
      }),
      this.prisma.renewalTask.count({
        where: { ...where },
      }),
      this.prisma.renewalTask.count({
        where: { ...where, status: 'COMPLETED' },
      }),
    ]);

    const recoveredSum = completedRenewals.reduce(
      (sum, p) => sum + Number(p.premiumAmount || 0),
      0,
    );
    const conversionRate =
      totalTasks > 0 ? ((completedTasks / totalTasks) * 100).toFixed(1) : '0';

    return {
      dueToday,
      in7Days,
      in15Days,
      in30Days,
      overdue,
      completed: completedTasks,
      conversionPercentage: `${conversionRate}%`,
      recoveredRevenue: `₹${recoveredSum.toLocaleString('en-IN')}`,
    };
  }

  @Get('renewals/upcoming')
  @ApiOperation({
    summary: 'Get upcoming renewals worklist by priority and days range',
  })
  async getUpcomingRenewals(
    @Query('range') range?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    const isManager =
      user?.role === 'BRANCH_MANAGER' ||
      user?.role === 'TEAM_LEADER' ||
      user?.role === 'SUPER_ADMIN';

    const tasks = await this.prisma.renewalTask.findMany({
      where: isManager ? {} : { agentId: user?.id },
      take: 50,
      orderBy: { dueDate: 'asc' },
      include: {
        policy: {
          include: { contact: true },
        },
      },
    });

    return tasks;
  }

  @Post('renewals/:id/lost')
  @ApiOperation({ summary: 'Capture lost renewal reason analysis' })
  async captureLostReason(
    @Param('id', ParseUUIDPipe) taskId: string,
    @Body() dto: { reason: string; competitorName?: string; notes?: string },
  ) {
    return this.prisma.renewalTask.update({
      where: { id: taskId },
      data: {
        status: 'CANCELLED',
      },
    });
  }

  @Get('renewal/pipeline')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  async getRenewalPipeline(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.renewalEngineService.getRenewalPipeline(user, pagination);
  }

  @Get('renewals/queue')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.RENEWAL_EXECUTIVE,
  )
  @ApiOperation({
    summary:
      'Get authoritative Renewal Executive Queue with NCB roll-over and urgency breakdown',
  })
  async getRenewalQueue(
    @Query('search') search?: string,
    @Query('urgency') urgency?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.renewalEngineService.getRenewalQueue({
      search,
      urgency,
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
    });
  }

  @Post('renewals/:id/remind')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.RENEWAL_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Dispatch on-demand renewal reminder to customer' })
  async triggerManualReminder(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.renewalEngineService.triggerManualReminder(id, user.id);
  }

  @Post('renewals/:id/escalate')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.RENEWAL_EXECUTIVE,
  )
  @ApiOperation({
    summary: 'Escalate critical expiring renewal to Branch Management',
  })
  async escalateRenewal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.renewalEngineService.escalateRenewal(id, user.id);
  }

  @Post('renewal/trigger-scan')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async triggerRenewalScan() {
    return this.renewalSchedulerCron.runManually();
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
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getPolicyService.executeAll(pagination, user);
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
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
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
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
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
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RenewPolicyDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.renewPolicyService.execute(id, dto, user.id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.cancelPolicyService.execute(id, comments, user.id);
  }
}
