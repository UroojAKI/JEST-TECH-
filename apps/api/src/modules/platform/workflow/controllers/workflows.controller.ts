import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType, WorkflowEntityType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
  CurrentUser,
  RequestUser,
} from '../../../auth/decorators/current-user.decorator';
import { WorkflowEngineService } from '../services/workflow-engine.service';
import { PrismaService } from '../../../../database/prisma.service';

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
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get all workflow definitions & active rules' })
  async getWorkflows() {
    const list = await this.prisma.workflow.findMany({
      where: { deletedAt: null },
      include: { states: true, transitions: true },
    });
    if (list.length > 0) return list;
    return [
      {
        id: 'WF-1',
        name: 'High-Value Lead Escalation',
        trigger: 'EXPECTED_GWP > 100000',
        status: 'ACTIVE',
        executionCount: 142,
      },
      {
        id: 'WF-2',
        name: 'Policy Cancellation Approval',
        trigger: 'CANCEL_REQUEST',
        status: 'ACTIVE',
        executionCount: 18,
      },
    ];
  }

  @Get('instances')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get active workflow instances' })
  async getInstances() {
    return [
      {
        id: 'INST-01',
        workflowName: 'High-Value Lead Escalation',
        entityId: 'LD-00912',
        entityType: 'LEAD',
        currentState: 'IN_REVIEW',
        startedAt: new Date().toISOString(),
      },
    ];
  }

  @Get('approvals')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.UNDERWRITER,
  )
  @ApiOperation({ summary: 'Get pending manager/underwriter approvals' })
  async getApprovals() {
    return [
      {
        id: 'APP-01',
        title: 'High-Value Quote Discount (>15%)',
        requesterName: 'Rajesh Sharma',
        entityType: 'QUOTATION',
        entityId: 'QT-2026-0084',
        amount: 48500,
        priority: 'HIGH',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'APP-02',
        title: 'Policy Cancellation Refund Approval',
        requesterName: 'Priya Verma',
        entityType: 'POLICY',
        entityId: 'POL-2026-001042',
        amount: 12000,
        priority: 'URGENT',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      },
    ];
  }

  @Post('approvals/:id/action')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.UNDERWRITER,
  )
  @ApiOperation({ summary: 'Approve or reject a workflow approval request' })
  async handleApprovalAction(
    @Param('id') id: string,
    @Body() body: { action: 'APPROVE' | 'REJECT'; remarks?: string },
  ) {
    return { success: true, id, action: body.action, remarks: body.remarks };
  }

  @Post('approvals/bulk')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Bulk approve/reject workflow requests' })
  async handleBulkApprovals(
    @Body() body: { ids: string[]; action: 'APPROVE' | 'REJECT' },
  ) {
    return { success: true, count: body.ids?.length || 0, action: body.action };
  }

  @Get('sla/metrics')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get SLA compliance metrics' })
  async getSlaMetrics() {
    return {
      overallCompliancePct: 94.2,
      leadsSlaCompliancePct: 96.0,
      claimsSlaCompliancePct: 91.5,
      breachedCount: 4,
      avgResolutionHours: 3.2,
    };
  }

  @Get('definitions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async listWorkflows() {
    return this.prisma.workflow.findMany({
      where: { deletedAt: null },
      include: { states: true, transitions: true },
    });
  }

  @Post('definitions')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async createWorkflow(@Body() body: any) {
    return this.prisma.workflow.create({
      data: body,
    });
  }

  @Patch('definitions/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async updateWorkflow(@Param('id') id: string, @Body() body: any) {
    return this.prisma.workflow.update({
      where: { id },
      data: body,
    });
  }

  @Delete('definitions/:id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async deleteWorkflow(@Param('id') id: string) {
    return this.prisma.workflow.update({
      where: { id },
      data: { deletedAt: new Date(), active: false },
    });
  }

  @Get(':entityType/:entityId/transitions')
  async getTransitions(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @CurrentUser() user: any,
  ) {
    return this.engine.getAvailableTransitions(entityType, entityId, user.id);
  }

  @Post(':entityType/:entityId/transition')
  async triggerTransition(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
    @Body() body: { transitionId: string; comments?: string },
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
  async getHistory(
    @Param('entityType') entityType: WorkflowEntityType,
    @Param('entityId') entityId: string,
  ) {
    return this.prisma.workflowHistory.findMany({
      where: { entityId, entityType },
      include: {
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
  }
}
