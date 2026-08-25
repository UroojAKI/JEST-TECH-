import { Module } from '@nestjs/common';

import { MotorController } from './motor.controller';
import { MotorWorkflowController } from './motor-workflow.controller';
import { MotorCalculationController } from './controllers/motor-calculation.controller';
import { MotorQuoteController } from './controllers/motor-quote.controller';
import { MotorTariffService } from './services/motor-tariff.service';
import { SaodVerificationService } from './services/saod-verification.service';
import { MotorRuleEngineService } from './services/motor-rule-engine.service';
import { MotorQuoteWorkflowService } from './services/motor-quote-workflow.service';
import { MotorInspectionService } from './services/motor-inspection.service';
import { MotorPaymentTrackingService } from './services/motor-payment-tracking.service';
import { MotorCalculationService } from './services/motor-calculation.service';
import { MotorPolicyIssuanceService } from './services/motor-policy-issuance.service';

@Module({
  controllers: [
    MotorController,
    MotorWorkflowController,
    MotorCalculationController,
    MotorQuoteController,
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
  ],
  exports: [
    MotorRuleEngineService,
    MotorInspectionService,
    MotorPaymentTrackingService,
    MotorCalculationService,
    MotorPolicyIssuanceService,
  ],
})
export class MotorModule {}
