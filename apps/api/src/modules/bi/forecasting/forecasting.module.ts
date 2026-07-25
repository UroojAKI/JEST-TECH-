import { Module } from '@nestjs/common';
import { StatisticalPredictionService } from './services/statistical-prediction/statistical-prediction.service';
import { ForecastingController } from './controllers/forecasting.controller';

@Module({
  controllers: [ForecastingController],
  providers: [StatisticalPredictionService],
  exports: [StatisticalPredictionService],
})
export class ForecastingModule {}
