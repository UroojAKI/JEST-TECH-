import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationType, NotificationPriority } from '@prisma/client';

@Processor('renewal-reminders')
@Injectable()
export class RenewalReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalReminderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-renewal-reminder') {
      const { policyId, policyNumber, expiryDate, customerId, agentId, daysBefore } = job.data;
      
      this.logger.log(`Processing renewal reminder for policy ${policyNumber}, ${daysBefore} days before expiry`);

      let notifType: NotificationType = NotificationType.SYSTEM;
      if (daysBefore === 45) notifType = NotificationType.POLICY_RENEWAL_45;
      else if (daysBefore === 30) notifType = NotificationType.POLICY_RENEWAL_30;
      else if (daysBefore === 20) notifType = NotificationType.POLICY_RENEWAL_20;
      
      if (agentId) {
        await this.prisma.notification.create({
          data: {
            title: `Policy Renewal Reminder: ${policyNumber}`,
            message: `Policy ${policyNumber} is expiring in ${daysBefore} days on ${new Date(expiryDate).toLocaleDateString()}.`,
            type: notifType,
            priority: NotificationPriority.HIGH,
            userId: agentId,
            entityId: policyId,
            entityType: 'POLICY',
          },
        });
      }

      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'POLICY_RENEWAL_REMINDER',
          entityId: policyId,
          newValue: { daysBefore, policyNumber },
          userId: agentId,
        },
      });

      // Update renewal task status if exists
      await this.prisma.renewalTask.updateMany({
        where: { policyId, status: 'PENDING' },
        data: { updatedAt: new Date() },
      });
    }
  }
}
