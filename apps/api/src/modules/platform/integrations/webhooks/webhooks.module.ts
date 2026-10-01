import { Module } from '@nestjs/common';
import { WebhookGatewayController } from './controllers/webhook-gateway/webhook-gateway.controller';
import { PaymentWebhookReconciliationListener } from './listeners/payment-webhook-reconciliation.listener';
import { MotorModule } from '../../../motor/motor.module';

@Module({
  imports: [MotorModule],
  controllers: [WebhookGatewayController],
  providers: [PaymentWebhookReconciliationListener],
  exports: [PaymentWebhookReconciliationListener],
})
export class WebhooksModule {}
