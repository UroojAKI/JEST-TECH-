import { Module } from '@nestjs/common';
import { CommissionEngineService } from './services/commission-engine/commission-engine.service';

@Module({
  providers: [CommissionEngineService]
})
export class CommissionModule {}
