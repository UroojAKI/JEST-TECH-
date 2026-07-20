import { Injectable, BadRequestException, NotFoundException, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowEntityType, WorkflowModule as PrismaWorkflowModule } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { WorkflowAdapterRegistry } from './workflow-adapter-registry.service';
import { WorkflowStateMachine } from './workflow-state-machine.service';
import { AuditService } from '../../audit/services/audit.service';
import { JobType } from '@prisma/client';
import { QUEUE_PROVIDER_TOKEN, type QueueProvider } from '../../queue/interfaces/queue-provider.interface';

@Injectable()
export class WorkflowEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: WorkflowAdapterRegistry,
    private readonly stateMachine: WorkflowStateMachine,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
    @Inject(QUEUE_PROVIDER_TOKEN) private readonly queueProvider: QueueProvider,
  ) {}

  async getAvailableTransitions(
    entityType: WorkflowEntityType,
    entityId: string,
    userId: string,
  ): Promise<any[]> {
    const adapter = this.registry.getAdapter(entityType);
    if (!adapter) {
      throw new NotFoundException(`No workflow adapter registered for ${entityType}`);
    }

    const currentStateCode = await adapter.getCurrentState(entityId);
    
    const prismaModule = this.mapEntityTypeToModule(entityType);
    const workflow = await this.prisma.workflow.findFirst({
      where: { module: prismaModule, active: true },
      include: {
        states: true,
        transitions: {
          include: {
            fromState: true,
            toState: true,
            assignments: true,
          },
        },
      },
    });

    if (!workflow) return [];

    const variables = await adapter.getVariables(entityId);
    
    const available = workflow.transitions.filter((t) => {
      const isValidPath = this.stateMachine.validateTransition(currentStateCode, t);
      if (!isValidPath) return false;

      const conditionsMet = this.stateMachine.evaluateConditions(t.conditions, variables);
      return conditionsMet;
    });

    return available;
  }

  async transition(
    entityType: WorkflowEntityType,
    entityId: string,
    transitionId: string,
    userId: string,
    comments?: string,
  ): Promise<void> {
    const adapter = this.registry.getAdapter(entityType);
    if (!adapter) {
      throw new BadRequestException(`No workflow adapter registered for ${entityType}`);
    }

    await this.prisma.$transaction(async (tx) => {
      const currentStateCode = await adapter.getCurrentState(entityId);

      const transition = await tx.workflowTransition.findUnique({
        where: { id: transitionId },
        include: {
          fromState: true,
          toState: true,
          assignments: true,
          actions: true,
          workflow: true,
        },
      });

      if (!transition) {
        throw new NotFoundException(`Workflow transition with ID ${transitionId} not found`);
      }

      const workflow = transition.workflow;

      const isValidPath = this.stateMachine.validateTransition(currentStateCode, transition);
      if (!isValidPath) {
        throw new BadRequestException(
          `Invalid state transition path from '${currentStateCode}' using transition '${transition.name}'`,
        );
      }

      const variables = await adapter.getVariables(entityId);

      const conditionsMet = this.stateMachine.evaluateConditions(transition.conditions, variables);
      if (!conditionsMet) {
        throw new BadRequestException(`Workflow transition conditions are not satisfied for this entity`);
      }

      if (transition.assignments && transition.assignments.length > 0) {
        const user = await tx.user.findUnique({
          where: { id: userId },
        });
        if (!user) throw new BadRequestException('Executing user not found');

        const isAuthorized = transition.assignments.some((assignment) => {
          if (assignment.userId === userId) return true;
          if (assignment.roleId && assignment.roleId === user.roleId) return true;
          return false;
        });

        if (!isAuthorized) {
          throw new BadRequestException('User is not authorized to execute this transition');
        }
      }

      await adapter.updateState(entityId, transition.toState.code, tx);

      await tx.workflowHistory.create({
        data: {
          workflowId: workflow.id,
          workflowVersion: workflow.version,
          entityId,
          entityType,
          fromStateId: transition.fromStateId,
          toStateId: transition.toStateId,
          performedById: userId,
          comments,
          variables,
        },
      });

      await this.runWorkflowActions(transition.actions, entityId, variables, userId);

      this.eventEmitter.emit('workflow.transitioned', {
        workflowId: workflow.id,
        entityType,
        entityId,
        fromState: transition.fromState?.code || 'DRAFT',
        toState: transition.toState.code,
        performedBy: userId,
      });

      if (transition.toState.isTerminal) {
        this.eventEmitter.emit('workflow.completed', {
          workflowId: workflow.id,
          entityType,
          entityId,
          finalState: transition.toState.code,
        });
      }

      if (transition.toState.code.toUpperCase() === 'REJECTED') {
        this.eventEmitter.emit('workflow.rejected', {
          workflowId: workflow.id,
          entityType,
          entityId,
          comments,
        });
      }
    });
  }

  private mapEntityTypeToModule(entityType: WorkflowEntityType): PrismaWorkflowModule {
    switch (entityType) {
      case WorkflowEntityType.PROPOSAL:
        return PrismaWorkflowModule.PROPOSALS;
      case WorkflowEntityType.CLAIM:
        return PrismaWorkflowModule.CLAIMS;
      case WorkflowEntityType.POLICY:
        return PrismaWorkflowModule.POLICIES;
      case WorkflowEntityType.ENDORSEMENT:
        return PrismaWorkflowModule.ENDORSEMENTS;
      case WorkflowEntityType.LEAD:
        return PrismaWorkflowModule.LEADS;
      case WorkflowEntityType.QUOTATION:
        return PrismaWorkflowModule.QUOTATIONS;
      default:
        throw new BadRequestException(`Unsupported entity type: ${entityType}`);
    }
  }

  private async runWorkflowActions(
    actions: any[],
    entityId: string,
    variables: any,
    userId: string,
  ): Promise<void> {
    for (const action of actions) {
      try {
        if (action.type === 'AUDIT') {
          await this.auditService.log({
            userId,
            module: 'WORKFLOW',
            entity: 'WorkflowTransition',
            entityId,
            action: 'APPROVE',
            newValue: { variables, actionConfig: action.configuration },
          });
        } else if (action.type === 'NOTIFICATION') {
          const config = action.configuration || {};
          const title = config.title || 'Workflow Update';
          const content = config.content || `Entity ${entityId} transitioned.`;
          const recipientId = config.recipientId || userId;
          await this.queueProvider.enqueue(JobType.NOTIFICATION, {
            userId: recipientId,
            type: 'SYSTEM',
            title,
            message: content,
            priority: 'MEDIUM',
          });
        }
      } catch (err: any) {
        console.error(`Failed to execute workflow action: ${err.message}`);
      }
    }
  }
}
