import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { NotificationPriority, NotificationType } from '@prisma/client';

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(private readonly prisma: PrismaService) {}

  async dispatch(params: {
    userId: string;
    type: NotificationType;
    priority?: NotificationPriority;
    title: string;
    message: string;
    entityId?: string;
    entityType?: string;
    actionUrl?: string;
    icon?: string;
    color?: string;
  }) {
    const {
      userId,
      type,
      priority = NotificationPriority.MEDIUM,
      title,
      message,
      entityId,
      entityType,
      actionUrl,
      icon,
      color,
    } = params;

    // Fetch or create user preferences
    let preference = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preference) {
      preference = await this.prisma.notificationPreference.create({
        data: { userId },
      });
    }

    // Check if preference matches category
    let allowed = true;
    if (type.startsWith('POLICY_RENEWAL_')) {
      allowed = preference.renewals;
    } else if (type.startsWith('POLICY_') || type === 'POLICY_ISSUED' || type === 'POLICY_CANCELLED') {
      allowed = preference.policies;
    } else if (type.startsWith('CLAIM_')) {
      allowed = preference.claims;
    } else if (type.startsWith('LEAD_')) {
      allowed = preference.leads;
    }

    if (!allowed) {
      this.logger.log(`Notifications for type ${type} disabled by preferences for user ${userId}`);
      return;
    }

    // Dispatch to In-App if active
    if (preference.inApp) {
      const notification = await this.prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          priority,
          entityId,
          entityType,
          actionUrl,
          icon,
          color,
        },
      });

      await this.prisma.notificationHistory.create({
        data: {
          notificationId: notification.id,
          channel: 'IN_APP',
          status: 'SENT',
        },
      });
    }

    // Stubs for future channel adapters
    if (preference.email) {
      this.logger.log(`[Email Dispatch Stub] Sent email to ${userId}: ${title}`);
    }
    if (preference.sms) {
      this.logger.log(`[SMS Dispatch Stub] Sent SMS to ${userId}: ${title}`);
    }
    if (preference.whatsapp) {
      this.logger.log(`[WhatsApp Dispatch Stub] Sent WhatsApp to ${userId}: ${title}`);
    }
  }
}
