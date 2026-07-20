import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [CoreModule, WebhooksModule],
})
export class IntegrationsModule {}
