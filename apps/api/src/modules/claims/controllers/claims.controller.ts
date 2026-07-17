import { Body, Controller, Get, Param, Post, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { ReportClaimDto } from '../dto/report-claim.dto';
import { AssignSurveyorDto } from '../dto/assign-surveyor.dto';
import { AssessClaimDto } from '../dto/assess-claim.dto';
import { PayClaimDto } from '../dto/pay-claim.dto';

import { ReportClaimService } from '../services/commands/report-claim.service';
import { UploadClaimDocumentService } from '../services/commands/upload-claim-document.service';
import { AssignSurveyorService } from '../services/commands/assign-surveyor.service';
import { AssessClaimService } from '../services/commands/assess-claim.service';
import { ApproveClaimService } from '../services/commands/approve-claim.service';
import { PayClaimService } from '../services/commands/pay-claim.service';
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
    private readonly assessClaimService: AssessClaimService,
    private readonly approveClaimService: ApproveClaimService,
    private readonly payClaimService: PayClaimService,
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
  findAll() {
    return this.getClaimsService.executeAll();
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
  findOne(@Param('id') id: string) {
    return this.getClaimsService.executeOne(id);
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
    @Param('id') id: string,
    @Body() dto: { documentType: string; fileKey: string; fileName: string; fileSize: number },
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
    @Param('id') id: string,
    @Body() dto: AssignSurveyorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assignSurveyorService.execute(id, dto, user.id);
  }

  @Post(':id/assess')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.CLAIMS_OFFICER,
    RoleType.UNDERWRITER,
  )
  assess(
    @Param('id') id: string,
    @Body() dto: AssessClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.assessClaimService.execute(id, dto, user.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.CLAIMS_OFFICER,
    RoleType.UNDERWRITER,
  )
  approve(
    @Param('id') id: string,
    @Body('approve') approve: boolean,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approveClaimService.execute(id, approve, comments, user.id);
  }

  @Post(':id/pay')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.FINANCE)
  pay(
    @Param('id') id: string,
    @Body() dto: PayClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.payClaimService.execute(id, dto, user.id);
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.CLAIMS_OFFICER)
  close(
    @Param('id') id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closeClaimService.execute(id, comments, user.id);
  }
}
