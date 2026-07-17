import { Module } from '@nestjs/common';
import { VehicleMasterController } from './controllers/vehicle-master.controller';
import { RatingEngineController } from './controllers/rating-engine.controller';
import { VehicleMasterService } from './services/vehicle-master.service';
import { InsurerProductService } from './services/insurer-product.service';
import { RatingEngineService } from './services/rating-engine.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [VehicleMasterController, RatingEngineController],
  providers: [VehicleMasterService, InsurerProductService, RatingEngineService],
  exports: [VehicleMasterService, InsurerProductService, RatingEngineService],
})
export class MotorAdminModule {}
