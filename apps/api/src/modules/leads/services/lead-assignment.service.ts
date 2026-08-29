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

  /**
   * Assigns or reassigns a lead to a target agent enforcing team/branch boundaries.
   */
  async assignLead(leadId: string, targetAgentId: string, actor: ActorContext) {
    this.authzService.authorize(actor, 'LEAD', 'ASSIGN');

    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    const targetAgent = await this.prisma.user.findUnique({
      where: { id: targetAgentId },
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
      const fromAgentId = lead.assignedToId;

      const updated = await tx.lead.update({
        where: { id: leadId },
        data: {
          assignedToId: targetAgentId,
          updatedById: actor.userId,
        },
      });

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

      // Log Audit Trail
      await tx.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          entity: 'Lead',
          entityId: lead.id,
          entityType: 'LEAD_ASSIGNMENT',
          performedById: actor.userId,
          userId: actor.userId,
          module: 'LEADS',
          metadata: {
            leadCode: lead.leadCode,
            fromAgentId,
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
  async autoAssignRoundRobin(leadId: string, actor?: ActorContext) {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });
    if (!lead || lead.deletedAt) {
      throw new NotFoundException(`Lead with ID ${leadId} not found`);
    }

    // Determine candidate pool
    const userWhere: any = {
      status: UserStatus.ACTIVE,
      role: RoleType.SALES_AGENT,
      deletedAt: null,
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
      const updated = await tx.lead.update({
        where: { id: leadId },
        data: {
          assignedToId: selectedAgent.id,
          updatedById: actor?.userId || null,
        },
      });

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
  ) {
    this.authzService.authorize(actor, 'LEAD', 'ASSIGN');

    if (!leadIds || leadIds.length === 0) {
      throw new BadRequestException('No lead IDs provided for bulk assignment');
    }

    const targetAgent = await this.prisma.user.findUnique({
      where: { id: targetAgentId },
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
      const updateResult = await tx.lead.updateMany({
        where: {
          id: { in: leadIds },
          deletedAt: null,
        },
        data: {
          assignedToId: targetAgentId,
          updatedById: actor.userId,
        },
      });

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
            leadCount: updateResult.count,
            leadIds,
            toAgentId: targetAgentId,
          },
        },
      });

      return {
        reassignedCount: updateResult.count,
        targetAgentId,
        targetAgentName: `${targetAgent.firstName} ${targetAgent.lastName}`,
      };
    });
  }

  /**
   * Retrieves active workload telemetry across agents within actor's scope.
   */
  async getAgentWorkloadQueue(actor: ActorContext): Promise<WorkloadItem[]> {
    const userWhere: any = {
      status: UserStatus.ACTIVE,
      role: {
        in: [
          RoleType.SALES_AGENT,
          RoleType.SALES_EXECUTIVE,
          RoleType.POSP_ADVISOR,
        ],
      },
      deletedAt: null,
    };

    if (actor.role === RoleType.TEAM_LEADER && actor.teamId) {
      userWhere.teamId = actor.teamId;
    } else if (actor.role === RoleType.BRANCH_MANAGER && actor.branchId) {
      userWhere.branchId = actor.branchId;
    }

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
    if (
      actor.role === RoleType.SUPER_ADMIN ||
      actor.role === RoleType.ADMIN ||
      actor.role === RoleType.SALES_MANAGER
    ) {
      return; // Global assignment authority
    }

    if (actor.role === RoleType.TEAM_LEADER) {
      if (!actor.teamId || targetAgent.teamId !== actor.teamId) {
        throw new ForbiddenException(
          'Team Leader can only assign leads to agents within their own team',
        );
      }
      return;
    }

    if (actor.role === RoleType.BRANCH_MANAGER) {
      if (!actor.branchId || targetAgent.branchId !== actor.branchId) {
        throw new ForbiddenException(
          'Branch Manager can only assign leads to agents within their own branch',
        );
      }
      return;
    }

    throw new ForbiddenException('User role is not authorized to assign leads');
  }
}
