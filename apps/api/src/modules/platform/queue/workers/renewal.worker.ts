import { Injectable, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationType, NotificationPriority } from '@prisma/client';

@Injectable()
export class RenewalWorker {
  private readonly logger = new Logger(RenewalWorker.name);

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async process(job: Job): Promise<any> {
    const { policyId, offsetDays, policyNumber } = job.data || {};
    this.logger.log(
      `Processing Renewal job ${job.id} for policy ${policyNumber || policyId} (offset: ${offsetDays ?? 'N/A'} days)`,
    );

    if (!this.prisma || !policyId) {
      this.logger.warn(
        `[RenewalWorker] Missing PrismaService or policyId in job data.`,
      );
      return { skipped: true, reason: 'INVALID_JOB_DATA' };
    }

    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { contact: true, quotation: true },
    });

    if (!policy) {
      this.logger.warn(
        `[RenewalWorker] Policy ${policyId} not found in database.`,
      );
      return { skipped: true, reason: 'POLICY_NOT_FOUND' };
    }

    const days = offsetDays !== undefined ? Number(offsetDays) : 30;
    const expiryStr = policy.expiryDate
      ? new Date(policy.expiryDate).toLocaleDateString('en-IN')
      : 'N/A';

    // 1. In-app notification for assigned agent / creator
    const targetUserId = policy.quotation?.createdById || policy.createdById;
    if (targetUserId) {
      await this.prisma.notification.create({
        data: {
          title: `Policy Renewal Alert: ${policy.policyNumber} (${days <= 0 ? 'EXPIRED' : `${days} Days`})`,
          message:
            days <= 0
              ? `Policy ${policy.policyNumber} expired on ${expiryStr}. Immediate inspection and renewal required.`
              : `Policy ${policy.policyNumber} expires in ${days} days on ${expiryStr}. Follow up with customer.`,
          type:
            days <= 0
              ? NotificationType.SYSTEM
              : days <= 20
                ? NotificationType.POLICY_RENEWAL_20
                : days <= 30
                  ? NotificationType.POLICY_RENEWAL_30
                  : NotificationType.POLICY_RENEWAL_45,
          priority:
            days <= 7
              ? NotificationPriority.CRITICAL
              : NotificationPriority.HIGH,
          userId: targetUserId,
          entityId: policy.id,
          entityType: 'POLICY',
          actionUrl: `/renewals?policyId=${policy.id}`,
        },
      });
    }

    // 2. Outbound customer communication log with honest channel provider status
    if (policy.contactId) {
      const isEmailConfigured = Boolean(
        process.env.SMTP_HOST ||
        process.env.SENDGRID_API_KEY ||
        process.env.SES_REGION,
      );
      const deliveryStatus = isEmailConfigured ? 'QUEUED' : 'NOT_CONFIGURED';

      await this.prisma.communicationLog.create({
        data: {
          channel: 'EMAIL',
          direction: 'OUTBOUND',
          status: deliveryStatus as any,
          contactId: policy.contactId,
          entityType: 'POLICY',
          entityId: policy.id,
          provider: 'EMAIL_SERVICE',
          providerMessageId: `renewal-job-${job.id || Date.now()}`,
          subject: `Policy Renewal Notice - ${policy.policyNumber}`,
          messagePreview:
            `Your policy ${policy.policyNumber} is due for renewal on ${expiryStr}.`.slice(
              0,
              100,
            ),
          messageBody: `Dear Customer, your insurance policy ${policy.policyNumber} expires on ${expiryStr}. Please renew promptly to ensure continuous coverage.`,
        },
      });
    }

    // 3. Mark durable RenewalJob record as COMPLETED
    await this.prisma.renewalJob.updateMany({
      where: {
        policyId: policy.id,
        offsetDays: days,
        status: { in: ['PENDING', 'PROCESSING'] },
      },
      data: {
        status: 'COMPLETED',
        lastAttemptAt: new Date(),
        providerJobId: job.id?.toString(),
      },
    });

    return {
      success: true,
      policyId: policy.id,
      policyNumber: policy.policyNumber,
      offsetDays: days,
    };
  }
}
