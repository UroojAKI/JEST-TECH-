import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { NumberingEngineService } from './numbering-engine.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TasksController],
  providers: [TasksService, NumberingEngineService],
  exports: [TasksService, NumberingEngineService],
})
export class TasksModule {}
