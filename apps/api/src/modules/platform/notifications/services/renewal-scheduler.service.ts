import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import {
  PolicyStatus,
  RenewalTaskStatus,
} from '@prisma/client';


@Injectable()
export class RenewalScheduler {
  private readonly logger = new Logger(RenewalScheduler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatcher: NotificationDispatcher,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleRenewalReminders() {
    this.logger.log('Starting daily policy renewals expiry scan...');
    // Run catch-up scheduler with config-driven offsets
    await this.runRenewalScheduler();
    
    // Escalate overdue pending tasks
    await this.handleEscalations();
    
    this.logger.log('Daily renewals check finished.');
  }

  async runRenewalScheduler() {
    const config = await this.prisma.renewalConfiguration.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    const lookAheadDays = config?.lookAheadDays ?? 60;
    const reminderOffsets: number[] = (config?.reminderOffsets as number[]) ?? [30, 7, 1];

    const now = new Date();
    const lookAheadDate = new Date(now);
    lookAheadDate.setDate(lookAheadDate.getDate() + lookAheadDays);

    // Catch-up query: get ALL active policies expiring within the window
    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: { gte: now, lte: lookAheadDate },
        deletedAt: null,
      },
      include: { contact: true },
    });

    let tasksCreated = 0;
    for (const policy of policies) {
      for (const offset of reminderOffsets) {
        const dueDate = new Date(policy.expiryDate);
        dueDate.setDate(dueDate.getDate() - offset);

        // Only create task if one doesn't already exist for this policy+dueDate
        const existing = await this.prisma.renewalTask.findFirst({
          where: { policyId: policy.id, dueDate },
        });

        if (!existing) {
          // Find the assigned agent — use createdById or a default assignment logic
          const agentId = policy.createdById;
          if (!agentId) continue;

          await this.prisma.renewalTask.create({
            data: {
              policyId: policy.id,
              agentId,
              dueDate,
              status: RenewalTaskStatus.PENDING,
              priority: offset <= 7 ? 'HIGH' : 'MEDIUM',
            },
          });
          tasksCreated++;
        }
      }
    }
    this.logger.log(`Renewal scheduler: ${tasksCreated} new tasks created across ${policies.length} expiring policies.`);
  }

  async handleEscalations() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const overdueTasks = await this.prisma.renewalTask.findMany({
      where: {
        status: RenewalTaskStatus.PENDING,
        dueDate: { lt: today },
      },
      include: {
        policy: { include: { contact: true } },
        agent: { include: { manager: true } }
      }
    });

    for (const task of overdueTasks) {
      // Find the manager to escalate to, fallback to system admin
      const escalateToId = task.agent?.managerId || await this.getDefaultAgentId();
      if (!escalateToId) continue;

      await this.dispatcher.dispatch({
        userId: escalateToId,
        type: 'POLICY_RENEWAL_30' as any, // Escalation reuses renewal notification type
        priority: 'HIGH' as any,
        title: `URGENT: Overdue Renewal Escalation`,
        message: `Agent ${task.agent?.firstName} has an overdue renewal for Policy ${task.policy?.policyNumber}. Please review immediately.`,
        entityId: task.policyId,
        entityType: 'POLICY',
        actionUrl: `/policies/${task.policyId}`,
      });

      // Update task priority to high
      await this.prisma.renewalTask.update({
        where: { id: task.id },
        data: { priority: 'HIGH' }
      });
    }

    if (overdueTasks.length > 0) {
      this.logger.warn(`Escalated ${overdueTasks.length} overdue renewal tasks.`);
    }
  }

  private async getDefaultAgentId(): Promise<string | null> {
    // Look for a Sales Manager or System Administrator instead of random user
    const user = await this.prisma.user.findFirst({
      where: { 
        deletedAt: null,
        role: { code: { in: ['SALES_MANAGER', 'SYSTEM_ADMINISTRATOR'] } }
      },
      orderBy: { createdAt: 'asc' }
    });
    return user ? user.id : null;
  }
}
