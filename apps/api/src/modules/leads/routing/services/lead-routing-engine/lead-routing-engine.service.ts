import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Lead } from '@prisma/client';

@Injectable()
export class LeadRoutingEngineService {
  private readonly logger = new Logger(LeadRoutingEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates routing rules to find an appropriate queue,
   * then assigns the lead to an available agent in that queue using Round Robin.
   */
  async routeLead(leadId: string): Promise<Lead> {
    const lead = await this.prisma.lead.findUnique({
      where: { id: leadId },
    });

    if (!lead) throw new Error('Lead not found');

    // 1. Evaluate Routing Rules
    const rules = await this.prisma.assignmentRule.findMany({
      where: { isActive: true },
      orderBy: { priority: 'desc' },
    });

    let targetQueueId: string | null = null;
    for (const rule of rules) {
      if (this.evaluateCondition(rule.condition, lead)) {
        targetQueueId = rule.queueId;
        break;
      }
    }

    if (!targetQueueId) {
      this.logger.warn(`No routing rule matched for lead ${lead.id}`);
      return lead; // Stays unassigned
    }

    // 2. Select Agent from Queue (Round Robin)
    // For round robin, we pick the agent with the lowest current load and available
    const availableAgents = await this.prisma.queueMember.findMany({
      where: {
        queueId: targetQueueId,
        isAvailable: true,
      },
      orderBy: { currentLoad: 'asc' }, // The one with lowest load gets it
    });

    if (availableAgents.length === 0) {
      this.logger.warn(
        `No available agents in queue ${targetQueueId} for lead ${lead.id}`,
      );
      return lead;
    }

    const selectedAgent = availableAgents[0];

    // 3. Assign Lead
    const updatedLead = await this.prisma.$transaction(async (tx) => {
      // Increment load for agent
      await tx.queueMember.update({
        where: { id: selectedAgent.id },
        data: { currentLoad: { increment: 1 } },
      });
      const targetAgent = await tx.agent.findFirst({
        where: {
          userId: selectedAgent.userId,
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
          assignedToId: selectedAgent.userId,
          agentId: newAgentId,
          agentExternalCodeId: newExternalCodeId,
        },
      });
      if (
        (previousAgentId !== newAgentId ||
          previousExternalCodeId !== newExternalCodeId) &&
        tx.agentAssignmentHistory?.create
      ) {
        const changedById =
          lead.updatedById || lead.createdById || selectedAgent.userId;
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
            reason: 'Lead assigned by queue routing',
          },
        });
        await tx.auditLog.create({
          data: {
            action: 'UPDATE',
            entity: 'AgentAssignment',
            entityId: history.id,
            entityType: 'AGENT_ASSIGNMENT',
            userId: changedById,
            performedById: changedById,
            module: 'AGENTS',
            oldValue: { previousAgentId, previousExternalCodeId },
            newValue: { newAgentId, newExternalCodeId, reason: 'Lead assigned by queue routing' },
          },
        });
      }
      return updated;
    });

    return updatedLead;
  }

  private evaluateCondition(conditionJson: string, leadData: any): boolean {
    try {
      const condition = JSON.parse(conditionJson);
      if (condition.field && condition.operator && condition.value) {
        const actualValue = leadData[condition.field];
        switch (condition.operator) {
          case 'EQUALS':
            return actualValue === condition.value;
          case 'NOT_EQUALS':
            return actualValue !== condition.value;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }
}
