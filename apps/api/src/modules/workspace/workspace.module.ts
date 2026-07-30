import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WorkspaceController } from './controllers/workspace.controller';
import { SalesWorkspaceController } from './controllers/sales-workspace.controller';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceFactory } from './factories/workspace.factory';
import { LeadWorkflowService } from './services/lead-workflow.service';
import { LeadAssignmentService } from './services/lead-assignment.service';
import { ReferralService } from './services/referral.service';
import { PerformanceService } from './services/performance.service';

@Module({
  imports: [DatabaseModule],
  controllers: [WorkspaceController, SalesWorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceFactory,
    LeadWorkflowService,
    LeadAssignmentService,
    ReferralService,
    PerformanceService,
  ],
  exports: [
    WorkspaceService,
    WorkspaceFactory,
    LeadWorkflowService,
    LeadAssignmentService,
    ReferralService,
    PerformanceService,
  ],
})
export class WorkspaceModule {}
