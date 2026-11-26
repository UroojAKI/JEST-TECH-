import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnyAuthenticatedRole } from '../auth/decorators/any-authenticated.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';
import { ClickToCallService } from './click-to-call.service';
import { CallHistoryService } from './call-history.service';
import { IncomingCallService } from './incoming-call.service';

@ApiTags('Telephony')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AnyAuthenticatedRole()
@Controller('telephony')
export class TelephonyController {
  constructor(
    private readonly clickToCall: ClickToCallService,
    private readonly callHistory: CallHistoryService,
    private readonly incoming: IncomingCallService,
  ) {}

  @Post('leads/:leadId/call')
  @ApiOperation({
    summary: 'Click-to-call: connect the logged-in agent to the lead via Exotel',
  })
  callLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clickToCall.callLead(leadId, user);
  }

  @Post('contacts/:contactId/call')
  @ApiOperation({
    summary: 'Click-to-call: connect the logged-in agent to a contact via Exotel',
  })
  callContact(
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clickToCall.callContact(contactId, user);
  }

  @Post('customers/:customerId/call')
  @ApiOperation({
    summary: 'Click-to-call: connect the logged-in agent to a customer via Exotel',
  })
  callCustomer(
    @Param('customerId', ParseUUIDPipe) customerId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clickToCall.callCustomer(customerId, user);
  }

  @Get('leads/:leadId/calls')
  @ApiOperation({ summary: 'Call history for a lead, newest first' })
  listLeadCalls(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.callHistory.listForLead(leadId, user);
  }

  @Get('calls')
  @ApiOperation({
    summary:
      'Call Logs: all calls the user may see (admin/back office: whole company; agent: own)',
  })
  listCalls(
    @CurrentUser() user: RequestUser,
    @Query('type') type?: string,
    @Query('result') result?: string,
    @Query('phone') phone?: string,
    @Query('page') page?: string,
  ) {
    return this.callHistory.listCalls(user, {
      type,
      result,
      phone,
      page: page ? Number(page) : 1,
    });
  }

  @Get('incoming/active')
  @ApiOperation({ summary: 'Incoming calls ringing for the logged-in agent' })
  activeIncomingCalls(@CurrentUser() user: RequestUser) {
    return this.incoming.activeForAgent(user.id);
  }

  @Get('calls/:callId/recording')
  @ApiOperation({ summary: 'Stream a call recording (access-checked)' })
  async getRecording(
    @Param('callId', ParseUUIDPipe) callId: string,
    @CurrentUser() user: RequestUser,
    @Res() res: Response,
  ) {
    const { body, contentType } = await this.callHistory.getRecording(
      callId,
      user,
    );
    res.set({
      'Content-Type': contentType,
      'Content-Length': String(body.length),
      'Cache-Control': 'private, no-store',
    });
    res.send(body);
  }
}
