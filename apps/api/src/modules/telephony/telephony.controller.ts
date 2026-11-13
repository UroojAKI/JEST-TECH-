import { Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnyAuthenticatedRole } from '../auth/decorators/any-authenticated.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/utils/parse-uuid.pipe';
import { ClickToCallService } from './click-to-call.service';

@ApiTags('Telephony')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@AnyAuthenticatedRole()
@Controller('telephony')
export class TelephonyController {
  constructor(private readonly clickToCall: ClickToCallService) {}

  @Post('leads/:leadId/call')
  @ApiOperation({
    summary: 'Click-to-call: connect the logged-in agent to the lead via Exotel',
  })
  callLead(
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.clickToCall.callLead(leadId, user.id, user.companyId);
  }
}
