import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { WarehouseModule } from '../../warehouse/warehouse.module';
import { ReportsController } from './controllers/reports.controller';
import { ReportsRepository } from './repositories/reports.repository';
import { ReportBuilderService } from './services/report-builder.service';
import { ExportService } from './services/export.service';
import { SchedulerService } from './services/scheduler.service';
import { ReportCommandsService } from './commands/report-commands.service';
import { ReportQueriesService } from './queries/report-queries.service';
import { ReportDataProviderRegistry } from './services/report-data-provider-registry.service';

@Module({
  imports: [DatabaseModule, WarehouseModule],
  controllers: [ReportsController],
  providers: [
    ReportsRepository,
    ReportBuilderService,
    ExportService,
    SchedulerService,
    ReportCommandsService,
    ReportQueriesService,
    ReportDataProviderRegistry,
  ],
  exports: [ReportsRepository, ReportBuilderService, ExportService, ReportDataProviderRegistry],
})
export class ReportsModule {}
