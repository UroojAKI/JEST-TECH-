import { Module } from '@nestjs/common';
import { LeadRoutingEngineService } from './services/lead-routing-engine/lead-routing-engine.service';

@Module({
  providers: [LeadRoutingEngineService],
})
export class RoutingModule {}
