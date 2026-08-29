import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  NotificationType,
  NotificationPriority,
  PolicyStatus,
} from '@prisma/client';

@Processor('renewal-reminders')
@Injectable()
export class RenewalReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenewalReminderProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    if (job.name === 'send-renewal-reminder') {
      const {
        policyId,
        policyNumber,
        expiryDate,
        customerId,
        agentId,
        daysBefore,
      } = job.data;

      this.logger.log(
        `Processing renewal reminder for policy ${policyNumber}, offset: ${daysBefore} days`,
      );

      // 1. Anti-spam / Idempotency check:
      // Skip if an identical reminder offset was recorded for this policy within last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const recentReminder = await this.prisma.auditLog.findFirst({
        where: {
          entity: 'POLICY_RENEWAL_REMINDER',
          entityId: policyId,
          createdAt: { gte: oneDayAgo },
        },
      });

      if (
        recentReminder &&
        (recentReminder.newValue as any)?.daysBefore === daysBefore
      ) {
        this.logger.warn(
          `Skipping duplicate renewal reminder for policy ${policyNumber} (offset ${daysBefore}d already sent within 24h)`,
        );
        return { skipped: true, reason: 'DUPLICATE_24H' };
      }

      // 2. Determine Notification Priority & Type for Agent
      let notifType: NotificationType = NotificationType.SYSTEM;
      if (daysBefore === 45) notifType = NotificationType.POLICY_RENEWAL_45;
      else if (daysBefore === 30)
        notifType = NotificationType.POLICY_RENEWAL_30;
      else if (daysBefore <= 20 && daysBefore > 0)
        notifType = NotificationType.POLICY_RENEWAL_20;

      let priority: NotificationPriority = NotificationPriority.MEDIUM;
      if (daysBefore <= 7) priority = NotificationPriority.CRITICAL;
      else if (daysBefore <= 30) priority = NotificationPriority.HIGH;

      const formattedExpiry = new Date(expiryDate).toLocaleDateString('en-IN');

      // 3. Create In-App Notification for Agent
      if (agentId) {
        await this.prisma.notification.create({
          data: {
            title: `Renewal Alert: ${policyNumber} (${daysBefore <= 0 ? 'OVERDUE' : `${daysBefore} Days`})`,
            message:
              daysBefore <= 0
                ? `Policy ${policyNumber} expired on ${formattedExpiry}. Inspection required upon renewal.`
                : `Policy ${policyNumber} is expiring in ${daysBefore} days on ${formattedExpiry}. Contact customer to secure renewal.`,
            type: notifType,
            priority,
            userId: agentId,
            entityId: policyId,
            entityType: 'POLICY',
            actionUrl: `/renewals?policyId=${policyId}`,
          },
        });
      }

      // 4. Create Outbound Communication Log for Customer
      if (customerId) {
        const contact = await this.prisma.contact.findUnique({
          where: { id: customerId },
        });

        if (contact) {
          const customerName =
            `${contact.firstName || 'Valued'} ${contact.lastName || 'Customer'}`.trim();
          const messageBody =
            daysBefore <= 0
              ? `Dear ${customerName}, your insurance policy ${policyNumber} expired on ${formattedExpiry}. Please renew immediately to avoid loss of coverage and break-in penalty.`
              : `Dear ${customerName}, your insurance policy ${policyNumber} is due for renewal on ${formattedExpiry} (${daysBefore} days remaining). Renew early to retain your No Claim Bonus (NCB).`;

          await this.prisma.communicationLog.create({
            data: {
              channel: 'EMAIL',
              direction: 'OUTBOUND',
              status: 'SENT',
              contactId: customerId,
              entityType: 'POLICY',
              entityId: policyId,
              subject: `Policy Renewal Reminder - ${policyNumber}`,
              messagePreview: messageBody.slice(0, 100),
              messageBody,
              sentAt: new Date(),
            },
          });
        }
      }

      // 5. Automated Policy Lifecycle Progression
      if (daysBefore <= 30 && daysBefore >= 0) {
        // Transition ACTIVE -> PENDING_RENEWAL
        await this.prisma.policy.updateMany({
          where: { id: policyId, status: PolicyStatus.ACTIVE },
          data: { status: PolicyStatus.PENDING_RENEWAL },
        });
      } else if (daysBefore < 0) {
        // Transition to LAPSED if overdue
        await this.prisma.policy.updateMany({
          where: {
            id: policyId,
            status: { in: [PolicyStatus.ACTIVE, PolicyStatus.PENDING_RENEWAL] },
          },
          data: { status: PolicyStatus.LAPSED },
        });
      }

      // 6. Record Immutable Audit Log
      await this.prisma.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'POLICY_RENEWAL_REMINDER',
          entityId: policyId,
          newValue: { daysBefore, policyNumber, expiryDate },
          userId: agentId || 'SYSTEM',
        },
      });

      // 7. Update Renewal Task timestamp
      await this.prisma.renewalTask.updateMany({
        where: { policyId, status: 'PENDING' },
        data: { updatedAt: new Date() },
      });

      return { success: true, policyNumber, daysBefore };
    }
  }
}
