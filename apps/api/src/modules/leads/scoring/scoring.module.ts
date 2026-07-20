import { Module } from '@nestjs/common';
import { LeadScoringEngineService } from './services/lead-scoring-engine/lead-scoring-engine.service';

@Module({
  providers: [LeadScoringEngineService]
})
export class ScoringModule {}
