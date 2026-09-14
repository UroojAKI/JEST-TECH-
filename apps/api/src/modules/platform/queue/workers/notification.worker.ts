import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../../database/prisma.service';

@Injectable()
export class NotificationWorker {
  private readonly logger = new Logger(NotificationWorker.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(job: Job): Promise<void> {
    this.logger.log(
      `Processing Notification job ${job.id} with payload: ${JSON.stringify(job.data)}`,
    );

    const {
      notificationId,
      channel = 'IN_APP',
      userId,
      title,
      message,
    } = job.data || {};

    try {
      if (notificationId) {
        // Record delivery event / update notification status in history
        await this.prisma.notificationHistory.create({
          data: {
            notificationId,
            channel: channel || 'IN_APP',
            status: 'SENT',
          },
        });
        this.logger.log(
          `Updated delivery status for notification ${notificationId}`,
        );
      } else if (userId && title && message) {
        // Direct notification dispatch via worker
        const created = await this.prisma.notification.create({
          data: {
            userId,
            title,
            message,
            type: job.data.type || 'SYSTEM_ALERT',
            priority: job.data.priority || 'MEDIUM',
            entityId: job.data.entityId,
            entityType: job.data.entityType,
            actionUrl: job.data.actionUrl,
          },
        });
        await this.prisma.notificationHistory.create({
          data: {
            notificationId: created.id,
            channel: channel || 'IN_APP',
            status: 'SENT',
          },
        });
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to process notification delivery: ${err.message}`,
        err.stack,
      );
      if (notificationId) {
        await this.prisma.notificationHistory
          .create({
            data: {
              notificationId,
              channel: channel || 'IN_APP',
              status: 'FAILED',
            },
          })
          .catch(() => {});
      }
      throw err;
    }
  }
}
