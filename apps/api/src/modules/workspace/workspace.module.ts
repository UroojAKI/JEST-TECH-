import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LeadsModule } from '../leads/leads.module';
import { WorkspaceController } from './controllers/workspace.controller';
import { SalesWorkspaceController } from './controllers/sales-workspace.controller';
import { WorkspaceService } from './services/workspace.service';
import { WorkspaceFactory } from './factories/workspace.factory';
import { LeadWorkflowService } from './services/lead-workflow.service';
import { ReferralService } from './services/referral.service';
import { PerformanceService } from './services/performance.service';

@Module({
  imports: [DatabaseModule, LeadsModule],
  controllers: [WorkspaceController, SalesWorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceFactory,
    LeadWorkflowService,
    ReferralService,
    PerformanceService,
  ],
  exports: [
    WorkspaceService,
    WorkspaceFactory,
    LeadWorkflowService,
    ReferralService,
    PerformanceService,
  ],
})
export class WorkspaceModule {}
