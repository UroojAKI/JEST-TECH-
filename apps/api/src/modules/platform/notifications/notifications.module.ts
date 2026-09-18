import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationService } from './services/notification.service';
import { NotificationDispatcher } from './services/notification-dispatcher.service';
import { RenewalScheduler } from './services/renewal-scheduler.service';
import { NotificationsListener } from './listeners/notifications.listener';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { WhatsAppProvider } from './providers/whatsapp.provider';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationDispatcher,
    RenewalScheduler,
    NotificationsListener,
    EmailProvider,
    SmsProvider,
    WhatsAppProvider,
  ],
  exports: [
    NotificationService,
    NotificationDispatcher,
    EmailProvider,
    SmsProvider,
    WhatsAppProvider,
  ],
})
export class NotificationsModule {}
