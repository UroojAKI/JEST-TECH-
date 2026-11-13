import { Body, Controller, HttpCode, Post, Query } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ExotelWebhookService } from './exotel-webhook.service';

/** Public URL called by Exotel — protected by the ?token= secret */
@ApiExcludeController()
@Public()
@Controller('telephony/exotel')
export class ExotelWebhookController {
  constructor(private readonly webhooks: ExotelWebhookService) {}

  @Post('status-callback')
  @HttpCode(200)
  async statusCallback(
    @Query('token') token: string,
    @Body() payload: Record<string, any>,
  ) {
    this.webhooks.verifyToken(token);
    await this.webhooks.handleStatusCallback(payload);
    return { ok: true };
  }
}
