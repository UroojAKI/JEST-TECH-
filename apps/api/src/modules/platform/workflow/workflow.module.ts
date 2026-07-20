import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowAdapterRegistry } from './services/workflow-adapter-registry.service';
import { WorkflowStateMachine } from './services/workflow-state-machine.service';
import { WorkflowEngineService } from './services/workflow-engine.service';
import { WorkflowsController } from './controllers/workflows.controller';

@Module({
  imports: [DatabaseModule, AuditModule, NotificationsModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowAdapterRegistry,
    WorkflowStateMachine,
    WorkflowEngineService,
  ],
  exports: [WorkflowAdapterRegistry, WorkflowEngineService],
})
export class WorkflowModule {}
