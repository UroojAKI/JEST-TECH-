import { Module } from '@nestjs/common';
import { ProposalsController } from './controllers/proposals.controller';
import { ProposalService } from './services/proposal.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ProposalsController],
  providers: [ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
