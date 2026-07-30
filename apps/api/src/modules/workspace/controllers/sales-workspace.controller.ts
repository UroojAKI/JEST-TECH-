import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { LeadWorkflowService, WorkflowStage } from '../services/lead-workflow.service';
import { LeadAssignmentService } from '../services/lead-assignment.service';
import { ReferralService } from '../services/referral.service';
import { PerformanceService } from '../services/performance.service';
import { PrismaService } from '../../../database/prisma.service';

@ApiTags('Sales Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace/sales')
export class SalesWorkspaceController {
  constructor(
    private readonly workflowService: LeadWorkflowService,
    private readonly assignmentService: LeadAssignmentService,
    private readonly referralService: ReferralService,
    private readonly performanceService: PerformanceService,
    private readonly prisma: PrismaService
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get Sales Workspace aggregated dashboard payload' })
  async getDashboard(@CurrentUser() user: RequestUser) {
    const isManager =
      user.role === 'BRANCH_MANAGER' || user.role === 'TEAM_LEADER' || user.role === 'SUPER_ADMIN';

    const kpis = await this.performanceService.getSalesKpis(user.id, isManager);
    const pipeline = await this.performanceService.getSalesPipeline(isManager ? undefined : user.id);

    const todayCalls = await this.prisma.callLog.findMany({
      where: isManager ? {} : { userId: user.id },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { lead: { include: { contact: true } } },
    });

    return {
      kpis,
      pipeline,
      todayCalls,
    };
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get Top-Row and Bottom-Row KPI Cards' })
  getKpis(@CurrentUser() user: RequestUser) {
    const isManager =
      user.role === 'BRANCH_MANAGER' || user.role === 'TEAM_LEADER' || user.role === 'SUPER_ADMIN';
    return this.performanceService.getSalesKpis(user.id, isManager);
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Get Lead Pipeline distribution & stage leads' })
  getPipeline(@CurrentUser() user: RequestUser) {
    const isManager =
      user.role === 'BRANCH_MANAGER' || user.role === 'TEAM_LEADER' || user.role === 'SUPER_ADMIN';
    return this.performanceService.getSalesPipeline(isManager ? undefined : user.id);
  }

  @Post('lead/:id/move-stage')
  @ApiOperation({ summary: 'Transition lead workflow step via Controlled Sequential Workflow engine' })
  moveStage(
    @Param('id') leadId: string,
    @Body() dto: { targetStage: WorkflowStage; overrideReason?: string; remarks?: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.workflowService.transitionStage(
      leadId,
      dto.targetStage,
      { id: user.id, role: user.role },
      dto.overrideReason,
      dto.remarks
    );
  }

  @Get('lead/:id/stage-history')
  @ApiOperation({ summary: 'Get stage transition audit trail for a lead' })
  getStageHistory(@Param('id') leadId: string) {
    return this.workflowService.getStageHistory(leadId);
  }

  @Post('lead/:id/referral')
  @ApiOperation({ summary: 'Capture customer referral and auto-provision linked lead' })
  createReferral(
    @Param('id') leadId: string,
    @Body() dto: { referralName: string; phone: string; email?: string; relationship?: string; interestedProduct?: string },
    @CurrentUser() user: RequestUser
  ) {
    return this.referralService.createReferral(
      {
        sourceLeadId: leadId,
        referralName: dto.referralName,
        phone: dto.phone,
        email: dto.email,
        relationship: dto.relationship,
        interestedProduct: dto.interestedProduct,
      },
      user.id
    );
  }

  @Post('lead/:id/no-referral')
  @ApiOperation({ summary: 'Mark lead with explicit No Referral reason' })
  markNoReferral(@Param('id') leadId: string, @Body() dto: { reason: string }) {
    return this.referralService.markNoReferral(leadId, dto.reason);
  }

  @Post('lead/:id/calls')
  @ApiOperation({ summary: 'Log call interaction for a lead' })
  async logCall(
    @Param('id') leadId: string,
    @Body() dto: { callOutcome: string; notes?: string; scheduledFollowup?: string },
    @CurrentUser() user: RequestUser
  ) {
    const call = await this.prisma.callLog.create({
      data: {
        leadId,
        userId: user.id,
        callOutcome: dto.callOutcome,
        notes: dto.notes,
        scheduledFollowup: dto.scheduledFollowup ? new Date(dto.scheduledFollowup) : null,
      },
    });

    if (dto.scheduledFollowup) {
      await this.prisma.lead.update({
        where: { id: leadId },
        data: { nextFollowup: new Date(dto.scheduledFollowup) },
      });
    }

    return call;
  }

  @Post('lead/:id/crm-update')
  @ApiOperation({ summary: 'Complete final CRM update checklist' })
  async crmUpdate(@Param('id') leadId: string, @CurrentUser() user: RequestUser) {
    return this.workflowService.transitionStage(
      leadId,
      'CRM_UPDATED',
      { id: user.id, role: user.role },
      undefined,
      'CRM updated checklist completed'
    );
  }
}
