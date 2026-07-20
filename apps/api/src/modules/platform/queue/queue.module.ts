import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SystemQueueProcessor } from './system-queue.processor';

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
  providers: [QueueService, SystemQueueProcessor],
  exports: [QueueService, BullModule],
})
export class QueueModule {}
