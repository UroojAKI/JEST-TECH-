import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WarehouseService } from './services/warehouse.service';

@Module({
  imports: [DatabaseModule],
  providers: [WarehouseService],
  exports: [WarehouseService],
})
export class WarehouseModule {}
