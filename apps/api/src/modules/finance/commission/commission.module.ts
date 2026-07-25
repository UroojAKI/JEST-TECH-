import { Module } from '@nestjs/common';
import { CommissionEngineService } from './services/commission-engine/commission-engine.service';
import { CommissionController } from './controllers/commission.controller';

@Module({
  controllers: [CommissionController],
  providers: [CommissionEngineService],
  exports: [CommissionEngineService],
})
export class CommissionModule {}
