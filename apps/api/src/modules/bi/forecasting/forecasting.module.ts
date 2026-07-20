import { Module } from '@nestjs/common';
import { StatisticalPredictionService } from './services/statistical-prediction/statistical-prediction.service';

@Module({
  providers: [StatisticalPredictionService],
})
export class ForecastingModule {}
