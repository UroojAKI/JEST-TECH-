import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

import { ReportClaimDto } from '../dto/report-claim.dto';
import { AssignSurveyorDto } from '../dto/assign-surveyor.dto';

import { ReportClaimService } from '../services/commands/report-claim.service';
import { UploadClaimDocumentService } from '../services/commands/upload-claim-document.service';
import { AssignSurveyorService } from '../services/commands/assign-surveyor.service';
import { CloseClaimService } from '../services/commands/close-claim.service';
import {
  ApproveClaimService,
  ApproveClaimDto,
} from '../services/commands/approve-claim.service';
import {
  SettleClaimService,
  SettleClaimDto,
} from '../services/commands/settle-claim.service';
import {
  RejectClaimService,
  RejectClaimDto,
} from '../services/commands/reject-claim.service';
import { GetClaimsService } from '../services/queries/get-claims.service';

@ApiTags('Claims')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('claims')
export class ClaimsController {
  constructor(
    private readonly reportClaimService: ReportClaimService,
    private readonly uploadClaimDocumentService: UploadClaimDocumentService,
    private readonly assignSurveyorService: AssignSurveyorService,
    private readonly approveClaimService: ApproveClaimService,
    private readonly settleClaimService: SettleClaimService,
    private readonly rejectClaimService: RejectClaimService,
    private readonly closeClaimService: CloseClaimService,
    private readonly getClaimsService: GetClaimsService,
  ) {}

  @Post('report')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closeClaimService.execute(
      id,
      `WITHDRAWN: ${reason?.trim() || 'Claim voluntarily withdrawn by applicant'}`,
      user.id,
    );
  }
}
