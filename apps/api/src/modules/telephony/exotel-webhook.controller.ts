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
    return this.handleIncoming(event, token, query, body);
  }

  /**
   * Same as above, plus the IVR key the caller pressed. Exotel doesn't send
   * the key to the Connect applet, so each key's Connect uses its own URL:
   *   /telephony/exotel/incoming/popup/<secret>/key/1   (key 1's Connect)
   *   /telephony/exotel/incoming/popup/<secret>/key/2   (key 2's Connect) …
   */
  @All('incoming/:event/:token/key/:ivrOption')
  @HttpCode(200)
  async incomingEventWithKey(
    @Param('event') event: string,
    @Param('token') token: string,
    @Param('ivrOption') ivrOption: string,
    @Query() query: Record<string, unknown>,
    @Body() body: Record<string, unknown>,
  ) {
    if (!/^[0-9*#]{1,4}$/.test(ivrOption)) {
      throw new NotFoundException();
    }
    return this.handleIncoming(event, token, query, body, ivrOption);
  }

  private async handleIncoming(
    event: string,
    token: string,
    query: Record<string, unknown>,
    body: Record<string, unknown>,
    ivrOption?: string,
  ) {
    this.webhooks.verifyToken(token);
    if (!INCOMING_CALL_EVENTS.includes(event as IncomingCallEvent)) {
      throw new NotFoundException();
    }
    await this.incoming.handle(event as IncomingCallEvent, {
      ...(body && typeof body === 'object' ? body : {}),
      ...query,
      ...(ivrOption ? { digits: ivrOption } : {}),
    });
    return { ok: true };
  }
}
