import { Global, Module } from '@nestjs/common';
import { AuditService } from './services/audit.service';
import { DatabaseModule } from '../../../database/database.module';
import { ReportsModule } from '../reporting/reports.module';
import { AuditReportProvider } from './providers/audit-report.provider';
import { AuditController } from './controllers/audit.controller';

@Global()
@Module({
  imports: [DatabaseModule, ReportsModule],
  controllers: [AuditController],
  providers: [AuditService, AuditReportProvider],
  exports: [AuditService, AuditReportProvider],
})
export class AuditModule {}
