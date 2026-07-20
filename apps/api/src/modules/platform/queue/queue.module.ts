import { Global, Module } from '@nestjs/common';

import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SystemQueueProcessor } from './system-queue.processor';

import { QUEUE_PROVIDER_TOKEN } from './interfaces/queue-provider.interface';
import { BullMQProvider } from './providers/bullmq.provider';
import { QueueEventsListener } from './events/queue-events.listener';
import { NotificationWorker } from './workers/notification.worker';
import { RenewalWorker } from './workers/renewal.worker';
import { WorkflowWorker } from './workers/workflow.worker';
import { ReportWorker } from './workers/report.worker';
import { AuditWorker } from './workers/audit.worker';
import { QueueDashboardController } from './monitoring/queue-dashboard.controller';
import { QueueDashboardService } from './monitoring/queue-dashboard.service';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get<string>('redis.url'),
        },
      }),
    }),
    BullModule.registerQueue({
      name: 'system-queue',
    }),
  ],
  controllers: [QueueDashboardController],
  providers: [
    SystemQueueProcessor,
    {
      provide: QUEUE_PROVIDER_TOKEN,
      useClass: BullMQProvider,
    },
    QueueEventsListener,
    NotificationWorker,
    RenewalWorker,
    WorkflowWorker,
    ReportWorker,
    AuditWorker,
    QueueDashboardService,
  ],
  exports: [QUEUE_PROVIDER_TOKEN, BullModule],
})
export class QueueModule {}
