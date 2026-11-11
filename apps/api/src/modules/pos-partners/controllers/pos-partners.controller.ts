import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { PosPartnerService } from '../services/pos-partner.service';
import { PosInsurerMappingService } from '../services/pos-insurer-mapping.service';
import { PosEligibilityService } from '../services/pos-eligibility.service';
import { PosDocumentService } from '../services/pos-document.service';
import { PosCommissionAgreementService } from '../services/pos-commission-agreement.service';

import { CreatePosPartnerDto } from '../dto/create-pos-partner.dto';
import { UpdatePosPartnerDto } from '../dto/update-pos-partner.dto';
import { PosPartnerQueryDto } from '../dto/pos-partner-query.dto';
import { UpdatePosStatusDto } from '../dto/pos-status-update.dto';
import { PosInsurerMappingDto } from '../dto/pos-insurer-mapping.dto';
import { CreatePosDocumentDto } from '../dto/pos-document.dto';
import { CreatePosCommissionAgreementDto } from '../dto/pos-commission-agreement.dto';

@ApiTags('POS Partner Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('pos-partners')
export class PosPartnersController {
  constructor(
    private readonly partnerService: PosPartnerService,
    private readonly mappingService: PosInsurerMappingService,
    private readonly eligibilityService: PosEligibilityService,
    private readonly documentService: PosDocumentService,
    private readonly agreementService: PosCommissionAgreementService,
  ) {}

  @Post()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Register a new POS Partner with automatic activation' })
  async register(
    @Body() dto: CreatePosPartnerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerService.register(dto, user);
  }

  @Get('eligible')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT)
  @ApiOperation({ summary: 'Get eligible POS partners for policy form dropdown' })
  async getEligible(
    @CurrentUser() user: RequestUser,
    @Query('insurerId') insurerId?: string,
    @Query('insurerName') insurerName?: string,
    @Query('productType') productType?: string,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.eligibilityService.getEligiblePartners({
      companyId,
      insurerId,
      insurerName,
      productType,
    });
  }

  @Get('export.xlsx')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Export Agent POS master, policy attribution and audit activity to Excel' })
  async exportExcel(@CurrentUser() user: RequestUser, @Res() response: Response) {
    const buffer = await this.partnerService.exportExcel(user);
    response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    response.setHeader('Content-Disposition', 'attachment; filename="agent-pos-register.xlsx"');
    response.send(buffer);
  }

  @Get('kpis')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get POS Partner dashboard KPIs' })
  async getKpis(@CurrentUser() user: RequestUser) {
    return this.partnerService.getKpis(user);
  }

  @Get()
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List and search POS Partners' })
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query() query: PosPartnerQueryDto,
  ) {
    return this.partnerService.findAll(user, query);
  }

  @Get(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get POS Partner details' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerService.findOne(id, user);
  }

  @Patch(':id')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Update POS Partner basic details' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePosPartnerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerService.update(id, dto, user);
  }

  @Patch(':id/status')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Update POS Partner status (Suspend / Reactivate)' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePosStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerService.updateStatus(id, dto, user);
  }

  @Get(':id/history')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get POS Partner audit history' })
  async getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.partnerService.getHistory(id, user);
  }

  // ── Insurer Association Endpoints ──
  @Post(':id/insurer-mapping')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Create initial insurer association' })
  async createMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PosInsurerMappingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mappingService.createMapping(id, dto, user);
  }

  @Get(':id/insurer-mapping')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get current insurer association' })
  async getMapping(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.mappingService.getMapping(id, companyId);
  }

  @Patch(':id/insurer-mapping')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Perform authorized insurer remapping' })
  async remapInsurer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PosInsurerMappingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.mappingService.remapInsurer(id, dto, user);
  }

  // ── Document Endpoints ──
  @Post(':id/documents')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Attach verification document metadata' })
  async uploadDocument(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePosDocumentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.documentService.uploadDocument(id, dto, user);
  }

  @Get(':id/documents')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List verification documents' })
  async listDocuments(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.documentService.listDocuments(id, companyId);
  }

  // ── Commission Agreement Endpoints ──
  @Post(':id/commission-agreements')
  @Roles(RoleType.ADMIN)
  @ApiOperation({ summary: 'Record commercial commission agreement terms' })
  async createAgreement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreatePosCommissionAgreementDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.agreementService.createAgreement(id, dto, user);
  }

  @Get(':id/commission-agreements')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'List commercial commission agreements' })
  async listAgreements(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.agreementService.listAgreements(id, companyId);
  }
}
