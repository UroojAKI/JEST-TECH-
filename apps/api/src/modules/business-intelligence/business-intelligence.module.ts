import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { BiService } from './services/bi.service';
import { KpiService } from './services/kpi.service';
import { BiController } from './controllers/bi.controller';

@Module({
  imports: [DatabaseModule, WarehouseModule],
  controllers: [BiController],
  providers: [BiService, KpiService],
  exports: [BiService, KpiService],
})
export class BusinessIntelligenceModule {}
