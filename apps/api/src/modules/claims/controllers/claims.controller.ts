import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType, Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

import { ReportClaimDto } from '../dto/report-claim.dto';
import { AssignSurveyorDto } from '../dto/assign-surveyor.dto';
import { UpdateClaimDto } from '../dto/update-claim.dto';

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
import { ClaimRepository } from '../repositories/claim.repository';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ClaimMapper } from '../mappers/claim.mapper';

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
    private readonly claimRepository: ClaimRepository,
    private readonly authzService: ResourceAuthorizationService,
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

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Update claim surveyor details and approved amount' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || (claim as any).deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }
    this.authzService.authorize(user, 'CLAIM', 'UPDATE', claim);
    const data: any = {
      ...(dto.surveyorName !== undefined ? { surveyorName: dto.surveyorName } : {}),
      ...(dto.surveyorDetails !== undefined ? { surveyorDetails: dto.surveyorDetails } : {}),
      ...(dto.approvedAmount !== undefined ? { approvedAmount: new Prisma.Decimal(dto.approvedAmount) } : {}),
      updatedById: user.id,
    };
    const updated = await this.claimRepository.update(id, data);
    return ClaimMapper.toResponse(updated);
  }

  private async getAuthorizedClaim(
    id: string,
    user: RequestUser,
    action: 'READ' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'ASSIGN' = 'UPDATE',
  ) {
    const claim = await this.claimRepository.findById(id);
    if (!claim || (claim as any).deletedAt) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }
    this.authzService.authorize(user, 'CLAIM', action, claim);
    return claim;
  }

  @Post(':id/documents')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  async uploadDocument(
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
    await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.uploadClaimDocumentService.execute(id, dto, user.id);
  }

  @Post(':id/assign-surveyor')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async assignSurveyor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignSurveyorDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.getAuthorizedClaim(id, user, 'ASSIGN');
    return this.assignSurveyorService.execute(id, dto, user.id);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.getAuthorizedClaim(id, user, 'APPROVE');
    return this.approveClaimService.execute(id, dto, user);
  }

  @Post(':id/settle')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async settle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SettleClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    const claim = await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.settleClaimService.execute(
      id,
      dto,
      user.id,
      user.companyId || user.organizationId,
    );
  }

  @Post(':id/settlement/verify')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async verifySettlement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('verificationReference') verificationReference: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!verificationReference?.trim()) {
      throw new BadRequestException(
        'Finance verification reference is mandatory',
      );
    }
    await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.settleClaimService.verifySettlement(
      id,
      verificationReference.trim(),
      user.id,
      user.companyId || user.organizationId,
    );
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectClaimDto,
    @CurrentUser() user: RequestUser,
  ) {
    await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.rejectClaimService.execute(
      id,
      dto,
      user.id,
      user.companyId || user.organizationId,
    );
  }

  @Post(':id/close')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  async close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.closeClaimService.execute(id, comments, user.id, user);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  async withdraw(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    await this.getAuthorizedClaim(id, user, 'UPDATE');
    return this.closeClaimService.execute(
      id,
      `WITHDRAWN: ${reason?.trim() || 'Claim voluntarily withdrawn by applicant'}`,
      user.id,
      user,
    );
  }
}
