import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { AuditAction, RoleType, UserStatus } from '@prisma/client';

export interface WorkloadItem {
  agentId: string;
  agentName: string;
  email: string;
  branchId: string | null;
  teamId: string | null;
  activeLeadsCount: number;
  openTasksCount: number;
  status: string;
}

@Injectable()
export class LeadAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzService: ResourceAuthorizationService,
  ) {}

  private async updateLeadAssignment(
    tx: any,
    lead: any,
    assignedToId: string,
    actorId: string | null,
    correlationId: string | undefined,
    reason: string,
  ) {
    const targetAgent = await tx.agent.findFirst({
      where: {
        userId: assignedToId,
        companyId: lead.companyId,
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    const previousAgentId = lead.agentId || null;
    const newAgentId = targetAgent?.id || null;
    const previousExternalCodeId = lead.agentExternalCodeId || null;
    const newExternalCodeId =
      previousAgentId && previousAgentId === newAgentId
        ? previousExternalCodeId
        : null;

    const updated = await tx.lead.update({
      where: { id: lead.id },
      data: {
        assignedToId,
        agentId: newAgentId,
        agentExternalCodeId: newExternalCodeId,
        updatedById: actorId,
      },
    });

    if (
      (previousAgentId !== newAgentId ||
        previousExternalCodeId !== newExternalCodeId) &&
      tx.agentAssignmentHistory?.create
    ) {
      const changedById = actorId || assignedToId;
      const history = await tx.agentAssignmentHistory.create({
        data: {
          companyId: lead.companyId,
          entityType: 'LEAD',
          entityId: lead.id,
          previousAgentId,
          newAgentId,
          previousExternalCodeId,
          newExternalCodeId,
          changedById,
          reason,
          correlationId: correlationId || null,
        },
      });
      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: 'AgentAssignment',
          entityId: history.id,
          entityType: 'AGENT_ASSIGNMENT',
          userId: changedById,
          performedById: changedById,
          module: 'AGENTS',
          correlationId: correlationId || null,
          oldValue: {
            entityType: 'LEAD',
            entityId: lead.id,
            previousAgentId,
            previousExternalCodeId,
          },
          newValue: {
            entityType: 'LEAD',
            entityId: lead.id,
            newAgentId,
            newExternalCodeId,
            reason,
          },
        },
      });
    }
    return updated;
  }

  /**
   * Assigns or reassigns a lead to a target agent enforcing team/branch boundaries.
   */
  async assignLead(
    leadId: string,
    targetAgentId: string,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.authzService.authorize(actor, 'LEAD', 'ASSIGN');
    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required for lead assignment');

    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId, deletedAt: null },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const targetAgent = await this.prisma.user.findFirst({
      where: { id: targetAgentId, companyId },
    });
    if (!targetAgent || targetAgent.deletedAt) {
      throw new NotFoundException(
        `Target agent with ID ${targetAgentId} not found`,
      );
    }

    if (targetAgent.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Cannot assign lead to an inactive agent');
    }

    // Enforce Hierarchy Boundaries
    this.validateHierarchyBoundary(actor, targetAgent);

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.updateLeadAssignment(
        tx,
        lead,
        targetAgentId,
        actor.userId,
        correlationId,
        'Lead assigned or reassigned',
      );

      // Log Lead Activity
      await tx.activity.create({
        data: {
          leadId: lead.id,
          type: 'TASK',
          subject: 'Lead Reassigned',
          description: `Lead reassigned to ${targetAgent.firstName} ${targetAgent.lastName} by ${actor.firstName} ${actor.lastName} (${actor.role}).`,
          assignedToId: targetAgentId,
          createdById: actor.userId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: 'Lead',
          entityId: lead.id,
          entityType: 'LEAD_ASSIGNMENT',
          performedById: actor.userId,
          userId: actor.userId,
          module: 'LEADS',
          correlationId: correlationId || null,
          metadata: {
            leadCode: lead.leadCode,
            fromAgentId: lead.agentId || null,
            toAgentId: targetAgentId,
            assignedByRole: actor.role,
          },
        },
      });

      return updated;
    });
  }

  /**
   * Distributes an unassigned lead to the agent with lowest active workload (Round-Robin).
   */
  async autoAssignRoundRobin(
    leadId: string,
    actor?: ActorContext,
    correlationId?: string,
  ) {
    const companyId = actor?.companyId || actor?.organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required for auto-assignment');
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId, deletedAt: null },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    // Candidate pool is always constrained to the lead's authenticated tenant.
    const userWhere: any = {
      status: UserStatus.ACTIVE,
      role: RoleType.AGENT,
      deletedAt: null,
      companyId,
    };

    if (actor?.teamId) {
      userWhere.teamId = actor.teamId;
    } else if (actor?.branchId) {
      userWhere.branchId = actor.branchId;
    }

    const agents = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        leadsAssigned: {
          where: {
            status: {
              in: [
                'NEW',
                'CONTACTED',
                'QUALIFIED',
                'DOCS_RECEIVED',
                'QUOTE_PREPARED',
                'NEGOTIATION',
              ] as any,
            },
            deletedAt: null,
          },
          select: { id: true },
        },
      },
    });

    if (agents.length === 0) {
      throw new BadRequestException(
        'No active sales agents available in the designated scope for round-robin assignment',
      );
    }

    // Sort by lowest active lead count
    agents.sort((a, b) => a.leadsAssigned.length - b.leadsAssigned.length);
    const selectedAgent = agents[0];

    return this.prisma.$transaction(async (tx) => {
      const updated = await this.updateLeadAssignment(
        tx,
        lead,
        selectedAgent.id,
        actor?.userId || null,
        correlationId,
        'Lead auto-assigned by round-robin routing',
      );

      await tx.activity.create({
        data: {
          leadId: lead.id,
          type: 'TASK',
          subject: 'Lead Auto-Assigned (Round Robin)',
          description: `Lead auto-routed to ${selectedAgent.firstName} ${selectedAgent.lastName} based on lowest active capacity.`,
          assignedToId: selectedAgent.id,
          createdById: actor?.userId || null,
        },
      });

      return updated;
    });
  }

  /**
   * Reassigns a batch of leads to a single agent with boundary validation.
   */
  async bulkAssign(
    leadIds: string[],
    targetAgentId: string,
    actor: ActorContext,
    correlationId?: string,
  ) {
    this.authzService.authorize(actor, 'LEAD', 'ASSIGN');

    if (!leadIds || leadIds.length === 0) {
      throw new BadRequestException('No lead IDs provided for bulk assignment');
    }
    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required for bulk assignment');

    const targetAgent = await this.prisma.user.findFirst({
      where: { id: targetAgentId, companyId },
    });
    if (!targetAgent || targetAgent.deletedAt) {
      throw new NotFoundException(
        `Target agent with ID ${targetAgentId} not found`,
      );
    }

    if (targetAgent.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('Cannot assign leads to an inactive agent');
    }

    this.validateHierarchyBoundary(actor, targetAgent);

    return this.prisma.$transaction(async (tx) => {
      const leads = await tx.lead.findMany({
        where: {
          id: { in: leadIds },
          companyId,
          deletedAt: null,
        },
      });
      for (const lead of leads) {
        await this.updateLeadAssignment(
          tx,
          lead,
          targetAgentId,
          actor.userId,
          correlationId,
          'Lead assigned through bulk assignment',
        );
      }

      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: 'Lead',
          entityId: targetAgentId,
          entityType: 'LEAD_BULK_ASSIGNMENT',
          performedById: actor.userId,
          userId: actor.userId,
          module: 'LEADS',
          metadata: {
            leadCount: leads.length,
            leadIds,
            toAgentId: targetAgentId,
          },
        },
      });

      return {
        reassignedCount: leads.length,
        targetAgentId,
        targetAgentName: `${targetAgent.firstName} ${targetAgent.lastName}`,
      };
    });
  }

  /**
   * Retrieves active workload telemetry across agents within actor's scope.
   */
  async getAgentWorkloadQueue(actor: ActorContext): Promise<WorkloadItem[]> {
    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) throw new ForbiddenException('Company context is required for agent workload');
    const userWhere: any = {
      status: UserStatus.ACTIVE,
      role: { type: RoleType.AGENT },
      deletedAt: null,
      companyId,
    };

    const agents = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        branchId: true,
        teamId: true,
        status: true,
        leadsAssigned: {
          where: {
            status: {
              in: [
                'NEW',
                'CONTACTED',
                'QUALIFIED',
                'DOCS_RECEIVED',
                'QUOTE_PREPARED',
                'NEGOTIATION',
              ] as any,
            },
            deletedAt: null,
          },
          select: { id: true },
        },
        activitiesAssigned: {
          where: { status: 'PENDING' as any },
          select: { id: true },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    return agents.map((a) => ({
      agentId: a.id,
      agentName: `${a.firstName} ${a.lastName}`,
      email: a.email,
      branchId: a.branchId,
      teamId: a.teamId,
      activeLeadsCount: a.leadsAssigned.length,
      openTasksCount: a.activitiesAssigned.length,
      status: a.status,
    }));
  }

  private validateHierarchyBoundary(actor: ActorContext, targetAgent: any) {
    if (actor.role === RoleType.ADMIN) {
      return; // Global assignment authority
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      const targetCompanyId =
        targetAgent.companyId || targetAgent.branch?.zone?.region?.company?.id;
      if (targetCompanyId && targetCompanyId !== actor.companyId) {
        throw new ForbiddenException(
          'Back Office can only assign leads within their own organization',
        );
      }
      return;
    }

    throw new ForbiddenException('User role is not authorized to assign leads');
  }
}
