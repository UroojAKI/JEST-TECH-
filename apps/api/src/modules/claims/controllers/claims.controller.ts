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
  report(@Body() dto: ReportClaimDto, @CurrentUser() user: RequestUser) {
    return this.reportClaimService.execute(dto, user);
  }

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  create(@Body() dto: ReportClaimDto, @CurrentUser() user: RequestUser) {
    return this.reportClaimService.execute(dto, user);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getClaimsService.executeAll(pagination, user);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getClaimsService.executeOne(id, user);
  }

  @Post(':id/documents')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      documentType: string;
      fileKey: string;
      fileName: string;
      fileSize: number;
    },
    @CurrentUser() user: RequestUser,
  ) {
    return this.uploadClaimDocumentService.execute(id, dto, user.id);
  }

  @Post(':id/assign-surveyor')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  assignSurveyor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSurveyorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignSurveyorService.execute(id, dto, user.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approveClaimService.execute(id, dto, user);
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settleClaimService.execute(id, dto, user.id);
  }

  @Post(':id/settlement/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  verifySettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('verificationReference') verificationReference: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!verificationReference?.trim()) {
      throw new BadRequestException(
        'Finance verification reference is mandatory',
      );
    }
    return this.settleClaimService.verifySettlement(
      id,
      verificationReference.trim(),
      user.id,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rejectClaimService.execute(id, dto, user.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closeClaimService.execute(id, comments, user.id);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
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
