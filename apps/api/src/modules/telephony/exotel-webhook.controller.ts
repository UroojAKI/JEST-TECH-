import {
  All,
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { ExotelWebhookService } from './exotel-webhook.service';
import {
  INCOMING_CALL_EVENTS,
  IncomingCallEvent,
  IncomingCallService,
} from './incoming-call.service';

/** Public URLs called by Exotel — protected by the secret token */
@ApiExcludeController()
@Public()
@Controller('telephony/exotel')
export class ExotelWebhookController {
  constructor(
    private readonly webhooks: ExotelWebhookService,
    private readonly incoming: IncomingCallService,
  ) {}

  /** Result of a click-to-call (outbound) call */
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

  /**
   * Incoming (IVR) call events. The token is part of the path because
   * Exotel adds its own ?query parameters to these URLs.
   *   /telephony/exotel/incoming/popup/<secret>      (Connect → Create popup)
   *   /telephony/exotel/incoming/completed/<secret>  (Passthru after the call)
   *   /telephony/exotel/incoming/missed/<secret>     (Passthru if nobody answers)
   */
  @All('incoming/:event/:token')
  @HttpCode(200)
  async incomingEvent(
    @Param('event') event: string,
    @Param('token') token: string,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    this.webhooks.verifyToken(token);
    if (!INCOMING_CALL_EVENTS.includes(event as IncomingCallEvent)) {
      throw new NotFoundException();
    }
    await this.incoming.handle(event as IncomingCallEvent, {
      ...(body && typeof body === 'object' ? body : {}),
      ...query,
    });
    return { ok: true };
  }
}
