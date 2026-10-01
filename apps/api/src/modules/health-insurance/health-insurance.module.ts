import { Module } from '@nestjs/common';
import { AdministrationModule } from '../administration/administration.module';
import { AuthModule } from '../auth/auth.module';
import { HealthQuotationCaseController } from './controllers/health-quotation-case.controller';
import { HealthQuotationDocumentController } from './controllers/health-quotation-document.controller';
import { HealthQuotationCaseService } from './services/health-quotation-case.service';
import { HealthQuotationDocumentService } from './services/health-quotation-document.service';
import { HealthPremiumService } from './services/health-premium.service';
import { HealthDocumentRuleService } from './services/health-document-rule.service';
import { HealthPlanValidationService } from './services/health-plan-validation.service';

/**
 * Health Insurance CRM (Health_Insurance_CRM_Forms).
 * Not to be confused with HealthModule, which is the system health-check endpoint.
 */
@Module({
  imports: [AdministrationModule, AuthModule],
  controllers: [HealthQuotationCaseController, HealthQuotationDocumentController],
  providers: [
    HealthQuotationCaseService,
    HealthQuotationDocumentService,
    HealthPremiumService,
    HealthDocumentRuleService,
    HealthPlanValidationService,
  ],
  exports: [HealthQuotationCaseService, HealthPremiumService, HealthDocumentRuleService, HealthPlanValidationService],
})
export class HealthInsuranceModule {}
