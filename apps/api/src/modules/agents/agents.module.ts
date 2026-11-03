import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentIdentityResolverService } from './agent-identity-resolver.service';

@Module({
  imports: [DatabaseModule],
  controllers: [AgentsController],
  providers: [AgentsService, AgentIdentityResolverService],
  exports: [AgentsService, AgentIdentityResolverService],
})
export class AgentsModule {}
