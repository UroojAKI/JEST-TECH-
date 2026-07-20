import { Module } from '@nestjs/common';
import { WebhookGatewayController } from './controllers/webhook-gateway/webhook-gateway.controller';

@Module({
  controllers: [WebhookGatewayController],
})
export class WebhooksModule {}
