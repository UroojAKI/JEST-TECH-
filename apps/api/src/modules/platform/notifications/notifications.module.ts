import { Module } from '@nestjs/common';
import { NotificationsController } from './controllers/notifications.controller';
import { NotificationService } from './services/notification.service';
import { NotificationDispatcher } from './services/notification-dispatcher.service';
import { RenewalScheduler } from './services/renewal-scheduler.service';
import { NotificationsListener } from './listeners/notifications.listener';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationService,
    NotificationDispatcher,
    RenewalScheduler,
    NotificationsListener,
  ],
  exports: [NotificationService, NotificationDispatcher],
})
export class NotificationsModule {}
