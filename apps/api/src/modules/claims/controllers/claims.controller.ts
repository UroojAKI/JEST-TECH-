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

    private readonly closeClaimService: CloseClaimService,
    private readonly getClaimsService: GetClaimsService,
  ) {}

  @Post('report')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.SUPPORT,
    RoleType.CUSTOMER,
  )
  report(@Body() dto: ReportClaimDto, @CurrentUser() user: RequestUser) {
    return this.reportClaimService.execute(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE,
    RoleType.SUPPORT,
  )
  findAll(
    @Query() pagination: PaginationDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.getClaimsService.executeAll(pagination, user);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
    RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE,
    RoleType.SUPPORT,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.getClaimsService.executeOne(id, user);
  }

  @Post(':id/documents')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.CLAIMS_OFFICER,
    RoleType.OPERATIONS,
    RoleType.SUPPORT,
  )
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
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.CLAIMS_OFFICER,
  )
  assignSurveyor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSurveyorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignSurveyorService.execute(id, dto, user.id);
  }



  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.CLAIMS_OFFICER)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closeClaimService.execute(id, comments, user.id);
  }
}
