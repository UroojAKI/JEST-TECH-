import { Module } from '@nestjs/common';
import { EtlService } from './services/etl/etl.service';

@Module({
  providers: [EtlService]
})
export class DataWarehouseModule {}
