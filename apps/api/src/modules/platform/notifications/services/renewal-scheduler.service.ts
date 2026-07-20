import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationPriority, NotificationType, PolicyStatus, RenewalTaskStatus } from '@prisma/client';

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
    await this.scanAndAlert(45, NotificationType.POLICY_RENEWAL_45);
    await this.scanAndAlert(30, NotificationType.POLICY_RENEWAL_30);
    await this.scanAndAlert(20, NotificationType.POLICY_RENEWAL_20);
    this.logger.log('Daily renewals check finished.');
  }

  async scanAndAlert(days: number, type: NotificationType) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDateStart = new Date(today);
    targetDateStart.setDate(targetDateStart.getDate() + days);
    const targetDateEnd = new Date(targetDateStart);
    targetDateEnd.setDate(targetDateEnd.getDate() + 1);

    const policies = await this.prisma.policy.findMany({
      where: {
        status: PolicyStatus.ACTIVE,
        expiryDate: {
          gte: targetDateStart,
          lt: targetDateEnd,
        },
        deletedAt: null,
      },
      include: {
        createdBy: true,
        contact: true,
      },
    });

    this.logger.log(`Found ${policies.length} policies expiring in ${days} days.`);

    for (const policy of policies) {
      const agentId = policy.createdById || (await this.getDefaultAgentId());
      if (!agentId) continue;

      const title = `Policy Expiration Alert (${days} Days)`;
      const message = `Policy ${policy.policyNumber} for ${policy.contact.firstName} ${policy.contact.lastName} is expiring in ${days} days on ${policy.expiryDate.toLocaleDateString()}. Please initiate the renewal discussion.`;

      await this.dispatcher.dispatch({
        userId: agentId,
        type,
        priority: days <= 20 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
        title,
        message,
        entityId: policy.id,
        entityType: 'POLICY',
        actionUrl: `/dashboard?policyId=${policy.id}`,
      });

      await this.prisma.renewalTask.create({
        data: {
          policyId: policy.id,
          agentId,
          dueDate: policy.expiryDate,
          status: RenewalTaskStatus.PENDING,
          priority: days <= 20 ? NotificationPriority.HIGH : NotificationPriority.MEDIUM,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          userId: agentId,
          action: 'UPDATE',
          entity: 'POLICY',
          entityId: policy.id,
          newValue: {
            reminderDays: days,
            policyNumber: policy.policyNumber,
            message: `System automatically registered renewal task and alert for policy ${policy.policyNumber} (${days} days to expiry).`
          },
          ipAddress: '127.0.0.1',
        },
      });
    }
  }

  private async getDefaultAgentId(): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { deletedAt: null },
    });
    return user ? user.id : null;
  }
}
