import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { AuthModule } from '../auth/auth.module';
import { AgentsModule } from '../agents/agents.module';
import { LifeQuotationCaseController } from './controllers/life-quotation-case.controller';
import { LifeQuotationDocumentController } from './controllers/life-quotation-document.controller';
import { LifeQuotationCaseService } from './services/life-quotation-case.service';
import { LifeQuotationCalculationService } from './services/life-quotation-calculation.service';
import { LifeQuotationDocumentService } from './services/life-quotation-document.service';

/**
 * Life Insurance CRM Module
 * Implements LifeQuotationCase, LifeQuotationRider, LifeQuotationDocument
 * and 8 plan categories from Life_Insurance_CRM_Forms.
 */
@Module({
  imports: [AdministrationModule, AuthModule, AgentsModule],
  controllers: [LifeQuotationCaseController, LifeQuotationDocumentController],
  providers: [
    LifeQuotationCaseService,
    LifeQuotationCalculationService,
    LifeQuotationDocumentService,
  ],
  exports: [
    LifeQuotationCaseService,
    LifeQuotationCalculationService,
    LifeQuotationDocumentService,
  ],
})
export class LifeInsuranceModule {}

