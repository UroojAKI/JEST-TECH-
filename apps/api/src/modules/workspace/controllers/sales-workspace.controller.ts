import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AnyAuthenticatedRole } from '../../auth/decorators/any-authenticated.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import {
  LeadWorkflowService,
  WorkflowStage,
} from '../services/lead-workflow.service';
import { LeadAssignmentService } from '../services/lead-assignment.service';
import { ReferralService } from '../services/referral.service';
import { PerformanceService } from '../services/performance.service';
import { PrismaService } from '../../../database/prisma.service';
import { ParseUUIDPipe } from '../../../common/utils/parse-uuid.pipe';
import {
  MoveStageDto,
  CreateReferralDto,
  NoReferralDto,
  LogCallDto,
} from '../dto/workspace.dto';

@ApiTags('Sales Workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AnyAuthenticatedRole()
@Controller('workspace/sales')
export class SalesWorkspaceController {
  constructor(
    private readonly workflowService: LeadWorkflowService,
    private readonly assignmentService: LeadAssignmentService,
    private readonly referralService: ReferralService,
    private readonly performanceService: PerformanceService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get Sales Workspace aggregated dashboard payload' })
  async getDashboard(@CurrentUser() user: RequestUser) {
    const isManager = user.role === 'ADMIN' || user.role === 'BACK_OFFICE';
    const companyId = user.companyId || (user as any).organizationId;

    const kpis = await this.performanceService.getSalesKpis(user.id, isManager);
    const pipeline = await this.performanceService.getSalesPipeline(
      isManager ? undefined : user.id,
    );

    // F-008 FIX: Always scope to companyId; isManager only removes userId filter
    const todayCalls = await this.prisma.callLog.findMany({
      where: isManager
        ? { lead: { companyId } }
        : { userId: user.id, lead: { companyId } },
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

  @Get('tasks')
  @ApiOperation({ summary: 'Get Agent Work Queue actionable task badges' })
  async getWorkQueue(@CurrentUser() user: RequestUser) {
    const isManager = user.role === 'ADMIN' || user.role === 'BACK_OFFICE';
    const companyId = user.companyId || (user as any).organizationId;
    const where: any = { companyId, deletedAt: null };
    if (!isManager) where.assignedToId = user.id;

    const pendingQuotesCount = await this.prisma.lead.count({
      where: {
        ...where,
        currentWorkflowStep: { in: ['NEED_ANALYSIS', 'QUOTATION'] },
      },
    });

    const pendingDocsCount = await this.prisma.lead.count({
      where: { ...where, currentWorkflowStep: 'PROPOSAL' },
    });

    const paymentPendingCount = await this.prisma.lead.count({
      where: { ...where, currentWorkflowStep: 'PAYMENT' },
    });

    const policyIssuancePendingCount = await this.prisma.lead.count({
      where: { ...where, currentWorkflowStep: 'ISSUED' },
    });

    const renewalsDueTodayCount = await this.prisma.lead.count({
      where: { ...where, currentWorkflowStep: 'REFERRAL' },
    });

    return {
      pendingQuotations: pendingQuotesCount,
      pendingDocuments: pendingDocsCount,
      paymentPending: paymentPendingCount,
      policyIssuancePending: policyIssuancePendingCount,
      renewalsDueToday: renewalsDueTodayCount,
    };
  }

  @Get('motor-widgets')
  @ApiOperation({
    summary: 'Get live real-time widgets telemetry for motor sales workspace',
  })
  async getMotorWidgets(@CurrentUser() user: RequestUser) {
    const isManager = user.role === 'ADMIN' || user.role === 'BACK_OFFICE';
    const companyId = user.companyId || (user as any).organizationId;

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
      999,
    );
    const day7 = new Date(startOfToday.getTime() + 7 * 86400000);
    const day30 = new Date(startOfToday.getTime() + 30 * 86400000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // F-008 FIX: Always scope to companyId; isManager only removes userId filter
    const leadWhere: any = { companyId, deletedAt: null };
    const policyWhere: any = { companyId, deletedAt: null };
    const activityWhere: any = { deletedAt: null };
    const quoteWhere: any = { companyId, deletedAt: null };

    if (!isManager) {
      leadWhere.assignedToId = user.id;
      policyWhere.createdById = user.id;
      activityWhere.assignedToId = user.id;
      quoteWhere.createdById = user.id;
    }

    // 1. Pipeline Stages
    const [
      leadsCount,
      needAnalysisCount,
      quotationCount,
      proposalCount,
      negotiationCount,
      paymentCount,
      issuedCount,
    ] = await Promise.all([
      this.prisma.lead.count({
        where: {
          ...leadWhere,
          currentWorkflowStep: { in: ['ASSIGNED', 'CONTACTED', 'NEW'] },
        },
      }),
      this.prisma.lead.count({
        where: { ...leadWhere, currentWorkflowStep: 'NEED_ANALYSIS' },
      }),
      this.prisma.lead.count({
        where: { ...leadWhere, currentWorkflowStep: 'QUOTATION' },
      }),
      this.prisma.lead.count({
        where: { ...leadWhere, currentWorkflowStep: 'PROPOSAL' },
      }),
      this.prisma.lead.count({
        where: { ...leadWhere, currentWorkflowStep: 'NEGOTIATION' },
      }),
      this.prisma.lead.count({
        where: { ...leadWhere, currentWorkflowStep: 'PAYMENT' },
      }),
      this.prisma.lead.count({
        where: {
          ...leadWhere,
          currentWorkflowStep: { in: ['ISSUED', 'REFERRAL', 'CRM_UPDATED'] },
        },
      }),
    ]);

    const pipelineSteps = [
      { label: 'Lead', count: leadsCount, color: 'bg-blue-500' },
      {
        label: 'Need Analysis',
        count: needAnalysisCount,
        color: 'bg-cyan-500',
      },
      { label: 'Quotation', count: quotationCount, color: 'bg-amber-500' },
      { label: 'Proposal', count: proposalCount, color: 'bg-indigo-500' },
      { label: 'Negotiation', count: negotiationCount, color: 'bg-purple-500' },
      { label: 'Payment', count: paymentCount, color: 'bg-emerald-500' },
      { label: 'Issued', count: issuedCount, color: 'bg-emerald-700' },
    ];

    // 2. Renewals Queue
    const [
      renewalsToday,
      renewalsNext7,
      renewalsNext30,
      renewalsOverdue,
      renewalsLost,
      renewalsCompleted,
    ] = await Promise.all([
      this.prisma.policy.count({
        where: {
          ...policyWhere,
          status: 'ACTIVE' as any,
          expiryDate: { gte: startOfToday, lte: endOfToday },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyWhere,
          status: 'ACTIVE' as any,
          expiryDate: { gt: endOfToday, lte: day7 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyWhere,
          status: 'ACTIVE' as any,
          expiryDate: { gt: day7, lte: day30 },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyWhere,
          status: 'ACTIVE' as any,
          expiryDate: { lt: startOfToday },
        },
      }),
      this.prisma.policy.count({
        where: {
          ...policyWhere,
          status: { in: ['CANCELLED', 'LAPSED'] } as any,
        },
      }),
      this.prisma.policyRenewal.count(),
    ]);

    const renewals = [
      {
        label: 'Today',
        count: renewalsToday,
        color: 'bg-rose-500 text-white font-black',
      },
      {
        label: 'Next 7 Days',
        count: renewalsNext7,
        color: 'bg-amber-500/10 text-amber-600',
      },
      {
        label: 'Next 30 Days',
        count: renewalsNext30,
        color: 'bg-sky-500/10 text-sky-600',
      },
      {
        label: 'Overdue',
        count: renewalsOverdue,
        color: 'bg-red-500/10 text-red-600',
      },
      {
        label: 'Lost',
        count: renewalsLost,
        color: 'bg-muted/40 text-muted-foreground',
      },
      {
        label: 'Completed',
        count: renewalsCompleted,
        color: 'bg-emerald-500/10 text-emerald-600',
      },
    ];

    // 3. Today's Tasks
    const activities = await this.prisma.activity.findMany({
      where: activityWhere,
      take: 6,
      orderBy: { dueDate: 'asc' },
      include: { lead: { include: { contact: true } } },
    });

    const todayTasks = activities.map((a) => {
      const timeStr = a.dueDate
        ? new Date(a.dueDate).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : 'Anytime';
      return {
        id: a.id,
        time: timeStr,
        task: a.subject,
        type: a.type,
        status: a.status,
      };
    });

    // 4. Follow-ups
    const pendingLeads = await this.prisma.lead.findMany({
      where: {
        ...leadWhere,
        currentWorkflowStep: { notIn: ['ISSUED', 'REFERRAL', 'CRM_UPDATED'] },
      },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { contact: true },
    });

    const followups = pendingLeads.map((l) => {
      const name = l.contact
        ? `${l.contact.firstName || ''} ${l.contact.lastName || ''}`.trim() ||
          'Lead ' + l.leadCode
        : 'Lead ' + l.leadCode;
      const phone = l.contact?.phone || '—';
      let action = 'Call Lead';
      if (l.currentWorkflowStep === 'QUOTATION') action = 'Generate Quote';
      else if (l.currentWorkflowStep === 'PROPOSAL') action = 'Upload RC';
      else if (l.currentWorkflowStep === 'PAYMENT') action = 'Collect Payment';

      return {
        id: l.id,
        customer: name,
        status: (l.currentWorkflowStep || 'NEW').replace(/_/g, ' '),
        action,
        phone,
      };
    });

    // 5. Recent Policies
    const dbRecentPolicies = await this.prisma.policy.findMany({
      where: policyWhere,
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { contact: true, vehicle: true },
    });

    const recentPolicies = dbRecentPolicies.map((p) => ({
      id: p.id,
      no: p.policyNumber,
      customer: p.contact
        ? `${p.contact.firstName} ${p.contact.lastName || ''}`.trim()
        : '—',
      vehicle: p.vehicle
        ? `${p.vehicle.registrationNumber || ''} (${p.vehicle.makeModel || p.vehicle.category || ''})`.trim()
        : 'Motor Vehicle',
      premium: `₹${Number(p.premiumAmount || 0).toLocaleString('en-IN')}`,
      status: p.status,
      renewalDate: p.expiryDate
        ? new Date(p.expiryDate).toLocaleDateString('en-IN')
        : '—',
      statusBadge:
        p.status === 'ACTIVE'
          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
          : 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    }));

    // 6. Drafts
    const dbDrafts = await this.prisma.quotation.findMany({
      where: { ...quoteWhere, status: 'DRAFT' as any },
      take: 5,
      orderBy: { updatedAt: 'desc' },
      include: { contact: true, vehicle: true },
    });

    const drafts = dbDrafts.map((d) => ({
      id: d.id,
      customer: d.contact
        ? `${d.contact.firstName} ${d.contact.lastName || ''}`.trim()
        : 'Draft Customer',
      model: d.vehicle
        ? d.vehicle.makeModel || d.vehicle.category || 'Motor Policy'
        : 'Motor Policy',
      step: 'Quote Draft',
      href: `/sales/quotations`,
    }));

    // 7. Telemetry
    const [monthPoliciesAgg, totalLeadsCount, monthPoliciesCount] =
      await Promise.all([
        this.prisma.policy.aggregate({
          _sum: { premiumAmount: true },
          where: {
            ...policyWhere,
            status: 'ACTIVE' as any,
            createdAt: { gte: startOfMonth },
          },
        }),
        this.prisma.lead.count({ where: leadWhere }),
        this.prisma.policy.count({
          where: { ...policyWhere, createdAt: { gte: startOfMonth } },
        }),
      ]);

    const myPremium = Number(monthPoliciesAgg._sum?.premiumAmount || 0);
    const conversionRatio =
      totalLeadsCount > 0
        ? Number(((monthPoliciesCount / totalLeadsCount) * 100).toFixed(1))
        : 0;

    return {
      pipelineSteps,
      renewals,
      todayTasks,
      followups,
      recentPolicies,
      drafts,
      telemetry: {
        myPremium,
        policiesIssued: monthPoliciesCount,
        conversionRatio,
        myLeads: totalLeadsCount,
      },
    };
  }

  @Get('kpis')
  @ApiOperation({ summary: 'Get Top-Row and Bottom-Row KPI Cards' })
  getKpis(@CurrentUser() user: RequestUser) {
    const isManager = user.role === 'ADMIN' || user.role === 'BACK_OFFICE';
    return this.performanceService.getSalesKpis(user.id, isManager);
  }

  @Get('pipeline')
  @ApiOperation({ summary: 'Get Lead Pipeline distribution & stage leads' })
  getPipeline(@CurrentUser() user: RequestUser) {
    const isManager = user.role === 'ADMIN' || user.role === 'BACK_OFFICE';
    return this.performanceService.getSalesPipeline(
      isManager ? undefined : user.id,
    );
  }

  @Post('lead/:id/move-stage')
  @ApiOperation({
    summary:
      'Transition lead workflow step via Controlled Sequential Workflow engine',
  })
  moveStage(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: MoveStageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.transitionStage(
      leadId,
      dto.targetStage as WorkflowStage,
      { id: user.id, role: user.role },
      dto.overrideReason,
      dto.remarks,
    );
  }

  @Get('lead/:id/stage-history')
  @ApiOperation({ summary: 'Get stage transition audit trail for a lead' })
  getStageHistory(@Param('id', ParseUUIDPipe) leadId: string) {
    return this.workflowService.getStageHistory(leadId);
  }

  @Post('lead/:id/referral')
  @ApiOperation({
    summary: 'Capture customer referral and auto-provision linked lead',
  })
  createReferral(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateReferralDto,
    @CurrentUser() user: RequestUser,
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
      user.id,
    );
  }

  @Post('lead/:id/no-referral')
  @ApiOperation({ summary: 'Mark lead with explicit No Referral reason' })
  markNoReferral(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: NoReferralDto,
  ) {
    return this.referralService.markNoReferral(leadId, dto.reason);
  }

  @Post('lead/:id/calls')
  @ApiOperation({ summary: 'Log call interaction for a lead' })
  async logCall(
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() dto: LogCallDto,
    @CurrentUser() user: RequestUser,
  ) {
    const call = await this.prisma.callLog.create({
      data: {
        leadId,
        userId: user.id,
        callOutcome: dto.callOutcome,
        notes: dto.notes,
        scheduledFollowup: dto.scheduledFollowup
          ? new Date(dto.scheduledFollowup)
          : null,
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
  async crmUpdate(
    @Param('id', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.workflowService.transitionStage(
      leadId,
      'CRM_UPDATED',
      { id: user.id, role: user.role },
      undefined,
      'CRM updated checklist completed',
    );
  }
}
