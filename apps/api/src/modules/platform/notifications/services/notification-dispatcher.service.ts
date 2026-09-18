import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { NotificationPriority, NotificationType, NotificationStatus } from '@prisma/client';
import { EmailProvider } from '../providers/email.provider';
import { SmsProvider } from '../providers/sms.provider';
import { WhatsAppProvider } from '../providers/whatsapp.provider';

@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly emailProvider?: EmailProvider,
    @Optional() private readonly smsProvider?: SmsProvider,
    @Optional() private readonly whatsappProvider?: WhatsAppProvider,
  ) {}

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
    } else if (
      type.startsWith('POLICY_') ||
      type === 'POLICY_ISSUED' ||
      type === 'POLICY_CANCELLED'
    ) {
      allowed = preference.policies;
    } else if (type.startsWith('CLAIM_')) {
      allowed = preference.claims;
    } else if (type.startsWith('LEAD_')) {
      allowed = preference.leads;
    }

    if (!allowed) {
      this.logger.log(
        `Notifications for type ${type} disabled by preferences for user ${userId}`,
      );
      return;
    }

    // NOTIFY-002: Deterministic deduplication check (24-hour window)
    if (entityId) {
      const existing = await this.prisma.notification.findFirst({
        where: {
          userId,
          type,
          entityId,
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      });

      if (existing) {
        this.logger.warn(
          `[NOTIFY-002] Duplicate notification dropped for user ${userId}, type ${type}, entity ${entityId}.`,
        );
        return;
      }
    }

    let notificationId: string | null = null;

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
      notificationId = notification.id;

      await this.prisma.notificationHistory.create({
        data: {
          notificationId: notification.id,
          channel: 'IN_APP',
          status: 'SENT',
        },
      });
    }

    // External Channels Dispatch via Abstraction
    if (notificationId) {
      // 1. Email Channel
      if (preference.email && this.emailProvider) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, firstName: true, lastName: true },
        });
        if (user?.email) {
          const res = await this.emailProvider.send({
            to: user.email,
            recipientName: `${user.firstName} ${user.lastName}`.trim(),
            title,
            message,
            actionUrl,
          });
          await this.prisma.notificationHistory.create({
            data: {
              notificationId,
              channel: 'EMAIL',
              status: res.status === 'SENT' ? NotificationStatus.SENT : NotificationStatus.FAILED,
              failureReason: res.failureReason,
            },
          });
        }
      }

      // 2. SMS Channel
      if (preference.sms && this.smsProvider) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { phone: true },
        });
        if (user?.phone) {
          const res = await this.smsProvider.send({
            to: user.phone,
            title,
            message,
          });
          await this.prisma.notificationHistory.create({
            data: {
              notificationId,
              channel: 'SMS',
              status: res.status === 'SENT' ? NotificationStatus.SENT : NotificationStatus.FAILED,
              failureReason: res.failureReason,
            },
          });
        }
      }

      // 3. WhatsApp Channel
      if (preference.whatsapp && this.whatsappProvider) {
        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { phone: true },
        });
        if (user?.phone) {
          const res = await this.whatsappProvider.send({
            to: user.phone,
            title,
            message,
          });
          await this.prisma.notificationHistory.create({
            data: {
              notificationId,
              channel: 'WHATSAPP',
              status: res.status === 'SENT' ? NotificationStatus.SENT : NotificationStatus.FAILED,
              failureReason: res.failureReason,
            },
          });
        }
      }
    }
  }
}
