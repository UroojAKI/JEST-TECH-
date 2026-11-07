import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AdministrationModule } from '../administration/administration.module';
import { DocumentsModule } from '../documents/documents.module';
import { LoanCaseController } from './controllers/loan-case.controller';
import { LoanFacilityController } from './controllers/loan-facility.controller';
import { LoanCaseService } from './services/loan-case.service';
import { LoanFacilityService } from './services/loan-facility.service';
import { LoanCalculationService } from './services/loan-calculation.service';
import { LoanDocumentService } from './services/loan-document.service';

@Module({
  imports: [
    DatabaseModule,
    AdministrationModule,
    DocumentsModule,
  ],
  controllers: [
    LoanCaseController,
    LoanFacilityController,
  ],
  providers: [
    LoanCaseService,
    LoanFacilityService,
    LoanCalculationService,
    LoanDocumentService,
  ],
  exports: [
    LoanCaseService,
    LoanFacilityService,
    LoanCalculationService,
    LoanDocumentService,
  ],
})
export class LoansModule {}

