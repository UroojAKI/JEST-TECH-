import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { WarehouseModule } from '../warehouse/warehouse.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportLibraryService } from './services/report-library.service';
import { ReportBuilderService } from './services/report-builder.service';
import { ExportService } from './services/export.service';
import { SchedulerService } from './services/scheduler.service';

@Module({
  imports: [DatabaseModule, WarehouseModule],
  controllers: [ReportsController],
  providers: [ReportLibraryService, ReportBuilderService, ExportService, SchedulerService],
  exports: [ReportBuilderService, ExportService],
})
export class ReportsModule {}
