import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { OutboxProcessor } from './outbox.processor';
import { DatabaseModule } from '../../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [OutboxService, OutboxProcessor],
  exports: [OutboxService],
})
export class OutboxModule {}

