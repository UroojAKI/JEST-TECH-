import { Module, OnModuleInit } from '@nestjs/common';
import { ProposalsController } from './controllers/proposals.controller';
import { ProposalService } from './services/proposal.service';
import { DatabaseModule } from '../../database/database.module';
import { WorkflowModule } from '../platform/workflow/workflow.module';
import { WorkflowAdapterRegistry } from '../platform/workflow/services/workflow-adapter-registry.service';
import { ProposalWorkflowAdapter } from './services/proposal-workflow.adapter';

@Module({
  imports: [DatabaseModule, WorkflowModule],
  controllers: [ProposalsController],
  providers: [ProposalService, ProposalWorkflowAdapter],
  exports: [ProposalService, ProposalWorkflowAdapter],
})
export class ProposalModule implements OnModuleInit {
  constructor(
    private readonly registry: WorkflowAdapterRegistry,
    private readonly adapter: ProposalWorkflowAdapter,
  ) {}

  onModuleInit() {
    this.registry.register('PROPOSAL', this.adapter);
  }
}
