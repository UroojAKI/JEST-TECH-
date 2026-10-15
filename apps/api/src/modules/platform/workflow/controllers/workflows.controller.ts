import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType, WorkflowEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { AnyAuthenticatedRole } from '../../../auth/decorators/any-authenticated.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../../auth/decorators/current-user.decorator';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PrismaService } from '../../../../database/prisma.service';
import {
  CreateWorkflowDefinitionDto,
  UpdateWorkflowDefinitionDto,
} from '../dto/workflow-definition.dto';
import {
  ApprovalActionDto,
  BulkApprovalActionDto,
  TriggerWorkflowTransitionDto,
} from '../dto/workflow-action.dto';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowsController {
  constructor(
    private readonly engine: WorkflowEngineService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get all workflow definitions & active rules' })
  async getWorkflows() {
    return this.prisma.workflow.findMany({
      where: { deletedAt: null },
      include: {
        states: { orderBy: { name: 'asc' } },
        transitions: {
          include: {
            fromState: true,
            toState: true,
            assignments: { include: { role: true, user: true } },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  @Get('instances')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get active workflow instances' })
  async getInstances(@CurrentUser() user: RequestUser) {
    const allTenantAccess = Array.isArray((user as any).permissions) &&
      (user as any).permissions.includes('*');
    const companyId = user.companyId || (user as any).organizationId;
    if (!allTenantAccess && !companyId) return [];

    const historyRows = await this.prisma.workflowHistory.findMany({
      where: { workflow: { active: true, deletedAt: null } },
      include: {
        workflow: { select: { id: true, name: true, code: true, version: true } },
        performedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });
    if (!historyRows.length) return [];

    // WorkflowHistory stores state IDs but does not define Prisma relations to WorkflowState.
    // Resolve these IDs through the state table instead of requesting nonexistent nested includes.
    const referencedStateIds = Array.from(new Set(
      historyRows.flatMap((row) => [row.fromStateId, row.toStateId].filter(Boolean) as string[]),
    ));
    const stateRows = referencedStateIds.length
      ? await this.prisma.workflowState.findMany({
          where: { id: { in: referencedStateIds } },
          include: {
            assignments: {
              include: {
                role: { select: { id: true, name: true, code: true } },
                user: { select: { id: true, firstName: true, lastName: true, email: true } },
              },
            },
          },
        })
      : [];
    const statesById = new Map(stateRows.map((state) => [state.id, state]));

    const idsByType = new Map<string, Set<string>>();
    for (const row of historyRows) {
      if (!idsByType.has(row.entityType)) idsByType.set(row.entityType, new Set<string>());
      idsByType.get(row.entityType)!.add(row.entityId);
    }
    const entityDetails = await this.resolveEntityDetails(
      idsByType,
      companyId,
      allTenantAccess,
    );

    // Keep only entities owned by the current tenant unless this is an explicit
    // platform super-admin. Build a real state-transition timeline from persisted history.
    const scopedHistories = historyRows.filter((row) =>
      entityDetails.has([row.entityType, row.entityId].join('|')),
    );
    const timelineByEntity = new Map<string, any[]>();
    for (const row of scopedHistories) {
      const key = [row.workflowId, row.entityType, row.entityId].join('|');
      if (!timelineByEntity.has(key)) timelineByEntity.set(key, []);
      timelineByEntity.get(key)!.push({
        state: statesById.get(row.toStateId)?.name || row.toStateId,
        action: statesById.get(row.fromStateId || '')?.name
          ? statesById.get(row.fromStateId || '')!.name + ' → ' + (statesById.get(row.toStateId)?.name || row.toStateId)
          : statesById.get(row.toStateId)?.name || row.toStateId,
        performedBy: row.performedBy
          ? [row.performedBy.firstName, row.performedBy.lastName].filter(Boolean).join(' ') || row.performedBy.email
          : 'System',
        timestamp: row.createdAt.toISOString(),
        comments: row.comments || null,
      });
    }
    for (const timeline of timelineByEntity.values()) {
      timeline.sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    }

    // Determine the current state from the newest persisted transition. Filtering
    // terminal rows before grouping would incorrectly resurrect an older active state.
    const latestByEntity = new Map<string, (typeof scopedHistories)[number]>();
    for (const row of scopedHistories) {
      const key = [row.workflowId, row.entityType, row.entityId].join('|');
      if (!latestByEntity.has(key)) latestByEntity.set(key, row);
    }

    const now = Date.now();
    return Array.from(latestByEntity.values())
      .filter((row) => statesById.has(row.toStateId) && !statesById.get(row.toStateId)?.isTerminal)
      .map((row) => {
        const entityKey = [row.entityType, row.entityId].join('|');
        const metadata = entityDetails.get(entityKey)!;
        const enteredAt = row.createdAt;
        const currentState = statesById.get(row.toStateId);
        const minutesInState = Math.max(0, Math.floor((now - enteredAt.getTime()) / 60000));
        const slaMinutes = currentState?.slaMinutes ?? null;
        const minutesRemaining = slaMinutes == null ? null : slaMinutes - minutesInState;
        const slaStatus =
          slaMinutes == null ? 'NOT_CONFIGURED' :
          minutesRemaining! < 0 ? 'BREACHED' : 'ON_TRACK';
        const assigned = currentState?.assignments || [];
        const assignedApprover = assigned
          .map((assignment) =>
            assignment.user
              ? [assignment.user.firstName, assignment.user.lastName].filter(Boolean).join(' ') || assignment.user.email
              : assignment.role?.name || assignment.role?.code,
          )
          .filter(Boolean)
          .join(', ');
        return {
          id: [row.workflowId, row.entityType, row.entityId].join('|'),
          workflowId: row.workflowId,
          workflowName: row.workflow.name,
          workflowCode: row.workflow.code,
          workflowVersion: row.workflowVersion,
          entityType: row.entityType,
          entityId: row.entityId,
          entityNumber: metadata.entityNumber || row.entityId,
          customerName: metadata.customerName || null,
          status: metadata.status || null,
          currentState: currentState?.name || row.toStateId,
          currentStateCode: currentState?.code || row.toStateId,
          enteredAt: enteredAt.toISOString(),
          lastTransitionAt: enteredAt.toISOString(),
          lastTransitionBy: row.performedBy
            ? [row.performedBy.firstName, row.performedBy.lastName].filter(Boolean).join(' ') || row.performedBy.email
            : 'System',
          lastComments: row.comments || null,
          slaMinutes,
          minutesInState,
          minutesRemaining: minutesRemaining == null ? null : Math.max(0, minutesRemaining),
          slaDeadline: slaMinutes == null ? null : new Date(enteredAt.getTime() + slaMinutes * 60000).toISOString(),
          slaStatus,
          assignedApprover: assignedApprover || null,
          timeline: timelineByEntity.get([row.workflowId, row.entityType, row.entityId].join('|')) || [],
        };
      });
  }

  @Get('approvals')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get pending manager/underwriter approvals' })
  async getApprovals(@CurrentUser() user: RequestUser) {
    const instances = await this.getInstances(user);
    const actor = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, roleId: true },
    });
    if (!actor) return [];

    const queue = await Promise.all(
      instances.map(async (instance) => {
        const transitions = await this.engine.getAvailableTransitions(
          instance.entityType,
          instance.entityId,
          user.id,
        );
        const assignedTransitions = transitions.filter((transition: any) =>
          (transition.assignments || []).some((assignment: any) =>
            assignment.userId === user.id ||
            (actor.roleId && assignment.roleId === actor.roleId),
          ),
        );
        if (!assignedTransitions.length) return null;
        return {
          id: instance.id,
          title: instance.workflowName + ' — ' + instance.currentState,
          requesterName: instance.lastTransitionBy,
          entityType: instance.entityType,
          entityId: instance.entityId,
          amount: null,
          priority: instance.slaStatus === 'BREACHED' ? 'URGENT' : 'NORMAL',
          status: 'PENDING',
          createdAt: instance.enteredAt,
          slaStatus: instance.slaStatus,
          availableTransitions: assignedTransitions.map((transition: any) => ({
            id: transition.id,
            name: transition.name,
            toState: transition.toState?.name,
            toStateCode: transition.toState?.code,
          })),
        };
      }),
    );
    return queue.filter(Boolean);
  }

  @Post('approvals/:id/action')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Approve or reject a workflow approval request' })
  async handleApprovalAction(
    @Param('id') id: string,
    @Body() body: ApprovalActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.executeApprovalAction(id, body.action, body.remarks || body.comments, user);
  }

  @Post('approvals/bulk')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Bulk approve/reject workflow requests' })
  async handleBulkApprovals(
    @Body() body: BulkApprovalActionDto,
    @CurrentUser() user: RequestUser,
  ) {
    const results = [];
    for (const id of body.ids) {
      try {
        results.push({
          id,
          ...(await this.executeApprovalAction(id, body.action, undefined, user)),
        });
      } catch (error: any) {
        results.push({
          id,
          success: false,
          message: error?.message || 'Workflow transition failed',
        });
      }
    }
    return {
      success: results.every((result: any) => result.success),
      requested: body.ids.length,
      succeeded: results.filter((result: any) => result.success).length,
      failed: results.filter((result: any) => !result.success).length,
      results,
    };
  }

  @Get('sla/metrics')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get SLA compliance metrics' })
  async getSlaMetrics(@CurrentUser() user: RequestUser) {
    const instances = await this.getInstances(user);
    const tracked = instances.filter((item: any) => item.slaMinutes != null);
    const compliance = (items: any[]) => {
      if (!items.length) return null;
      const onTrack = items.filter((item) => item.slaStatus === 'ON_TRACK').length;
      return Math.round((onTrack / items.length) * 1000) / 10;
    };
    const avgCurrentStageHours = instances.length
      ? Math.round(
          (instances.reduce((total: number, item: any) => total + item.minutesInState / 60, 0) /
            instances.length) * 10,
        ) / 10
      : null;
    return {
      overallCompliancePct: compliance(tracked),
      leadsSlaCompliancePct: compliance(tracked.filter((item: any) => item.entityType === WorkflowEntityType.LEAD)),
      claimsSlaCompliancePct: compliance(tracked.filter((item: any) => item.entityType === WorkflowEntityType.CLAIM)),
      breachedCount: tracked.filter((item: any) => item.slaStatus === 'BREACHED').length,
      trackedInstances: tracked.length,
      runningInstances: instances.length,
      avgCurrentStageHours,
      dataAvailable: instances.length > 0,
    };
  }

  private async resolveEntityDetails(
    idsByType: Map<string, Set<string>>,
    companyId: string | undefined,
    allTenantAccess: boolean,
  ): Promise<Map<string, { entityNumber: string; customerName?: string | null; status?: string | null }>> {
    const output = new Map<string, { entityNumber: string; customerName?: string | null; status?: string | null }>();
    const ids = (type: string) => Array.from(idsByType.get(type) || []);
    const tenantWhere = companyId && !allTenantAccess ? { companyId } : {};
    const alive = { deletedAt: null };
    const [leads, quotations, policies, claims, proposals, endorsements] = await Promise.all([
      ids(WorkflowEntityType.LEAD).length ? this.prisma.lead.findMany({
        where: { id: { in: ids(WorkflowEntityType.LEAD) }, ...tenantWhere, ...alive },
        select: { id: true, leadCode: true, title: true, status: true },
      }) : [],
      ids(WorkflowEntityType.QUOTATION).length ? this.prisma.quotation.findMany({
        where: { id: { in: ids(WorkflowEntityType.QUOTATION) }, ...tenantWhere, ...alive },
        select: { id: true, quotationCode: true, title: true, status: true },
      }) : [],
      ids(WorkflowEntityType.POLICY).length ? this.prisma.policy.findMany({
        where: { id: { in: ids(WorkflowEntityType.POLICY) }, ...tenantWhere, ...alive },
        select: { id: true, policyNumber: true, status: true },
      }) : [],
      ids(WorkflowEntityType.CLAIM).length ? this.prisma.claim.findMany({
        where: { id: { in: ids(WorkflowEntityType.CLAIM) }, ...tenantWhere, ...alive },
        select: { id: true, claimNumber: true, status: true },
      }) : [],
      ids(WorkflowEntityType.PROPOSAL).length ? this.prisma.proposal.findMany({
        where: {
          id: { in: ids(WorkflowEntityType.PROPOSAL) },
          ...(companyId && !allTenantAccess ? { quotation: { companyId } } : {}),
        },
        select: { id: true, proposalNumber: true, status: true, contact: { select: { firstName: true, lastName: true } } },
      }) : [],
      ids(WorkflowEntityType.ENDORSEMENT).length ? this.prisma.endorsement.findMany({
        where: {
          id: { in: ids(WorkflowEntityType.ENDORSEMENT) },
          ...(companyId && !allTenantAccess ? { policy: { companyId } } : {}),
        },
        select: { id: true, endorsementNumber: true, status: true },
      }) : [],
    ]);
    for (const item of leads) output.set([WorkflowEntityType.LEAD, item.id].join('|'), { entityNumber: item.leadCode, customerName: item.title, status: String(item.status) });
    for (const item of quotations) output.set([WorkflowEntityType.QUOTATION, item.id].join('|'), { entityNumber: item.quotationCode, customerName: item.title, status: String(item.status) });
    for (const item of policies) output.set([WorkflowEntityType.POLICY, item.id].join('|'), { entityNumber: item.policyNumber, status: String(item.status) });
    for (const item of claims) output.set([WorkflowEntityType.CLAIM, item.id].join('|'), { entityNumber: item.claimNumber, status: String(item.status) });
    for (const item of proposals) output.set([WorkflowEntityType.PROPOSAL, item.id].join('|'), { entityNumber: item.proposalNumber, customerName: item.contact ? [item.contact.firstName, item.contact.lastName].filter(Boolean).join(' ') : null, status: String(item.status) });
    for (const item of endorsements) output.set([WorkflowEntityType.ENDORSEMENT, item.id].join('|'), { entityNumber: item.endorsementNumber, status: String(item.status) });
    return output;
  }

  private async executeApprovalAction(
    id: string,
    action: 'APPROVE' | 'REJECT',
    comments: string | undefined,
    user: RequestUser,
  ) {
    const parts = id.split('|');
    if (parts.length !== 3) {
      throw new NotFoundException('Approval request is not a live workflow instance. Refresh the queue and retry.');
    }
    const [workflowId, entityTypeRaw, entityId] = parts;
    const entityType = entityTypeRaw as WorkflowEntityType;
    if (!Object.values(WorkflowEntityType).includes(entityType)) {
      throw new BadRequestException('Invalid workflow entity type');
    }
    const instance = (await this.getInstances(user)).find(
      (item: any) => item.id === id && item.workflowId === workflowId,
    );
    if (!instance) {
      throw new NotFoundException('Workflow instance is no longer active or is outside your organization.');
    }

    const actor = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { id: true, roleId: true },
    });
    if (!actor) throw new NotFoundException('Executing user not found');

    const transitions = await this.engine.getAvailableTransitions(entityType, entityId, user.id);
    const assignedTransitions = transitions.filter((transition: any) =>
      (transition.assignments || []).some((assignment: any) =>
        assignment.userId === user.id ||
        (actor.roleId && assignment.roleId === actor.roleId),
      ),
    );
    const matchesDecision = assignedTransitions.filter((transition: any) => {
      const value = [
        transition.name,
        transition.toState?.name,
        transition.toState?.code,
      ].filter(Boolean).join(' ').toUpperCase();
      return action === 'APPROVE'
        ? /APPROV|ACCEPT|ISSUED|VERIFIED|COMPLETE/.test(value)
        : /REJECT|DECLIN|RETURN/.test(value);
    });
    const candidates = matchesDecision;
    if (candidates.length !== 1) {
      throw new BadRequestException(
        candidates.length === 0
          ? 'No assigned transition explicitly represents this approval/rejection decision. Name or configure the workflow transition/state accordingly.'
          : 'Multiple transitions match this decision. Choose a specific transition in the workflow instead of applying an ambiguous approval.',
      );
    }

    await this.engine.transition(entityType, entityId, candidates[0].id, user.id, comments);
    return { success: true, id, action, transitionId: candidates[0].id };
  }

  @Get('definitions')
  @Roles(RoleType.ADMIN)
  async listWorkflows() {
    return this.prisma.workflow.findMany({
      where: { deletedAt: null },
      include: { states: true, transitions: true },
    });
  }

  @Post('definitions')
  @Roles(RoleType.ADMIN)
  async createWorkflow(@Body() body: CreateWorkflowDefinitionDto) {
    return this.prisma.workflow.create({
      data: body,
    });
  }

  @Patch('definitions/:id')
  @Roles(RoleType.ADMIN)
  async updateWorkflow(
    @Param('id') id: string,
    @Body() body: UpdateWorkflowDefinitionDto,
  ) {
    return this.prisma.workflow.update({
      where: { id },
      data: body,
    });
  }

  @Delete('definitions/:id')
  @Roles(RoleType.ADMIN)
  async deleteWorkflow(@Param('id') id: string) {
    return this.prisma.workflow.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  @Get(':entityType/:entityId/transitions')
  @AnyAuthenticatedRole()
  async getTransitions(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.engine.getAvailableTransitions(entityType, entityId, user.id);
  }

  @Post(':entityType/:entityId/transition')
  @AnyAuthenticatedRole()
  async triggerTransition(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @Body() body: TriggerWorkflowTransitionDto,
    @CurrentUser() user: any,
  ) {
    await this.engine.transition(
      entityType,
      entityId,
      body.transitionId,
      user.id,
      body.comments,
    );
    return { success: true };
  }

  @Get(':entityType/:entityId/history')
  @AnyAuthenticatedRole()
  async getHistory(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    const allTenantAccess = Array.isArray((user as any).permissions) &&
      (user as any).permissions.includes('*');
    const companyId = user.companyId || (user as any).organizationId;
    if (!allTenantAccess && !companyId) {
      throw new NotFoundException('Workflow entity not found in the current organization.');
    }
    const scopedIds = new Map<string, Set<string>>([[entityType, new Set([entityId])]]);
    const entityDetails = await this.resolveEntityDetails(scopedIds, companyId, allTenantAccess);
    if (!entityDetails.has([entityType, entityId].join('|'))) {
      throw new NotFoundException('Workflow entity not found in the current organization.');
    }

    const history = await this.prisma.workflowHistory.findMany({
      where: { entityId, entityType, workflow: { deletedAt: null } },
      include: {
        workflow: { select: { id: true, name: true, code: true } },
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    const stateIds = Array.from(new Set(
      history.flatMap((row) => [row.fromStateId, row.toStateId].filter(Boolean) as string[]),
    ));
    const states = stateIds.length
      ? await this.prisma.workflowState.findMany({ where: { id: { in: stateIds } } })
      : [];
    const statesById = new Map(states.map((state) => [state.id, state]));
    return history.map((row) => ({
      ...row,
      fromState: row.fromStateId ? statesById.get(row.fromStateId) || null : null,
      toState: statesById.get(row.toStateId) || null,
    }));
  }
}
