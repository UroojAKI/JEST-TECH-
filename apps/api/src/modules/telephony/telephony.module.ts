import { Module } from '@nestjs/common';
import { ExotelClient } from './exotel.client';
import { ClickToCallService } from './click-to-call.service';
import { TelephonyController } from './telephony.controller';
import { ExotelWebhookService } from './exotel-webhook.service';
import { ExotelWebhookController } from './exotel-webhook.controller';

@Module({
  controllers: [TelephonyController, ExotelWebhookController],
  providers: [ExotelClient, ClickToCallService, ExotelWebhookService],
  exports: [ExotelClient],
})
export class TelephonyModule {}
