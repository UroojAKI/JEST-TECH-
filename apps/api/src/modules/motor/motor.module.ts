import { Module } from '@nestjs/common';

import { MotorController } from './motor.controller';
import { MotorWorkflowController } from './motor-workflow.controller';
import { MotorCalculationController } from './controllers/motor-calculation.controller';
import { MotorQuoteController } from './controllers/motor-quote.controller';
import { MotorInspectionController } from './controllers/motor-inspection.controller';
import { MotorRulesEvaluateController } from './controllers/motor-rules-evaluate.controller';
import { MotorTariffService } from './services/motor-tariff.service';
import { SaodVerificationService } from './services/saod-verification.service';
import { MotorRuleEngineService } from './services/motor-rule-engine.service';
import { MotorQuoteWorkflowService } from './services/motor-quote-workflow.service';
import { MotorInspectionService } from './services/motor-inspection.service';
import { MotorPaymentTrackingService } from './services/motor-payment-tracking.service';
import { MotorCalculationService } from './services/motor-calculation.service';
import { MotorPolicyIssuanceService } from './services/motor-policy-issuance.service';
import { VehicleDataService } from './services/vehicle-data.service';
import { PreviousPolicyService } from './services/previous-policy.service';
import { MotorDocumentRuleService } from './services/motor-document-rule.service';
import { MotorPolicyDateService } from './services/motor-policy-date.service';
import { AdministrationModule } from '../administration/administration.module';

@Module({
  imports: [AdministrationModule],
  controllers: [
    MotorController,
    MotorWorkflowController,
    MotorCalculationController,
    MotorQuoteController,
    MotorInspectionController,
    MotorRulesEvaluateController,
  ],
  providers: [
    MotorTariffService,
    SaodVerificationService,
    MotorRuleEngineService,
    MotorQuoteWorkflowService,
    MotorInspectionService,
    MotorPaymentTrackingService,
    MotorCalculationService,
    MotorPolicyIssuanceService,
    VehicleDataService,
    PreviousPolicyService,
    MotorDocumentRuleService,
    MotorPolicyDateService,
  ],
  exports: [
    MotorRuleEngineService,
    MotorInspectionService,
    MotorPaymentTrackingService,
    MotorCalculationService,
    MotorPolicyIssuanceService,
    VehicleDataService,
    PreviousPolicyService,
    MotorDocumentRuleService,
    MotorPolicyDateService,
  ],
})
export class MotorModule {}
