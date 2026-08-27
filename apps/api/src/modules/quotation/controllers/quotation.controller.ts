import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { SkipThrottle } from '@nestjs/throttler';

import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

import { CreateQuotationDto } from '../dto/create-quotation.dto';
import { CreateMotorCaptureDto } from '../dto/create-motor-capture.dto';
import { GenerateQuotationService } from '../services/commands/generate-quotation.service';
import { ApproveQuotationService } from '../services/commands/approve-quotation.service';
import { RejectQuotationService } from '../services/commands/reject-quotation.service';
import { ConvertQuotationService } from '../services/commands/convert-quotation.service';
import { AcceptQuotationService } from '../services/commands/accept-quotation.service';
import { CreateQuotationVersionService, CreateQuotationVersionInputDto } from '../services/commands/create-quotation-version.service';
import { GetQuotationService } from '../services/queries/get-quotation.service';
import { CompareQuotationService } from '../services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from '../services/queries/get-quotation-history.service';
import { ComparisonService } from '../engine/comparison.service';
import { PrismaService } from '../../../database/prisma.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';
import { MotorCalculationService } from '../../motor/services/motor-calculation.service';

@ApiTags('Quotations & Motor Wizard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotations')
export class QuotationController {
  constructor(
    private readonly generateQuotationService: GenerateQuotationService,
    private readonly approveQuotationService: ApproveQuotationService,
    private readonly rejectQuotationService: RejectQuotationService,
    private readonly convertQuotationService: ConvertQuotationService,
    private readonly acceptQuotationService: AcceptQuotationService,
    private readonly createQuotationVersionService: CreateQuotationVersionService,
    private readonly getQuotationService: GetQuotationService,
    private readonly compareQuotationService: CompareQuotationService,
    private readonly getQuotationHistoryService: GetQuotationHistoryService,
    private readonly comparisonEngine: ComparisonService,
    private readonly prisma: PrismaService,
    private readonly motorCalculationService: MotorCalculationService,
  ) {}

  @Post('motor-capture')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.SALES_MANAGER,
    RoleType.SALES_EXECUTIVE,
    RoleType.OPERATIONS,
    RoleType.POSP_ADVISOR,
    RoleType.RENEWAL_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Capture a Motor quotation using an authoritative backend calculation.' })
  async motorCapture(
    @Body() dto: CreateMotorCaptureDto,
    @CurrentUser() user: RequestUser,
  ) {
    const quotationCode = `MQ-${dto.vehicleCategory?.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-8)}`;

    let contactId = dto.contactId;
    if (!contactId && dto.leadId) {
      const lead = await this.prisma.lead.findUnique({ where: { id: dto.leadId }, select: { contactId: true } });
      contactId = lead?.contactId || undefined;
    }

    const proposer = dto.proposerDetails || {};
    if (!contactId && proposer['mobileNumber']) {
      const existingByPhone = await this.prisma.contact.findFirst({
        where: { phone: String(proposer['mobileNumber']).trim() },
        select: { id: true },
      });
      contactId = existingByPhone?.id;
    }

    if (!contactId && proposer['emailId']) {
      const existingByEmail = await this.prisma.contact.findFirst({
        where: { email: String(proposer['emailId']).trim() },
        select: { id: true },
      });
      contactId = existingByEmail?.id;
    }

    if (!contactId) {
      const [firstName, ...rest] = (proposer['customerName'] || 'Motor Customer').split(' ');
      const newContact = await this.prisma.contact.create({
        data: {
          contactCode: `MC-${Date.now().toString().slice(-8)}`,
          type: 'INDIVIDUAL',
          firstName: firstName || 'Motor',
          lastName: rest.join(' ') || 'Customer',
          email: proposer['emailId'] || `motor_${Date.now()}@jest.local`,
          phone: proposer['mobileNumber'] || `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          panNumber: proposer['panNumber'] || null,
          createdById: user.id,
        },
      });
      contactId = newContact.id;
    }

    const policyDetails = (dto.policyDetails || {}) as any;
    const vehicleDetails = (dto.vehicleDetails || {}) as any;
    const saodVerification = (dto.saodVerification || {}) as any;
    const policyTypeMap: Record<string, 'THIRD_PARTY_ONLY' | 'STANDALONE_OD' | 'PACKAGE_COMPREHENSIVE'> = {
      TP_ONLY: 'THIRD_PARTY_ONLY',
      SAOD: 'STANDALONE_OD',
      PACKAGE: 'PACKAGE_COMPREHENSIVE',
      THIRD_PARTY_ONLY: 'THIRD_PARTY_ONLY',
      STANDALONE_OD: 'STANDALONE_OD',
      PACKAGE_COMPREHENSIVE: 'PACKAGE_COMPREHENSIVE',
    };

    const calculationInput: any = {
      vehicleCategory: dto.vehicleCategory,
      vehicleSubType: vehicleDetails.vehicleSubType || vehicleDetails.vehicleType,
      vehicleStatus: vehicleDetails.vehicleStatus === 'NEW' ? 'NEW' : 'EXISTING',
      policyType: policyTypeMap[dto.policyType] || 'PACKAGE_COMPREHENSIVE',
      policyTenure: Number(policyDetails.policyTenure || 1) || 1,
      idv: dto.idv || Number(policyDetails.insuredDeclaredValue || 0) || undefined,
      ncbPercent: Number(dto.ncbPercentage || policyDetails.ncbPercentage || 0),
      claimInExpiringPolicy: String(policyDetails.claimInExpiringPolicy || '').toLowerCase() === 'yes',
      paCover: Boolean(policyDetails.paCoverOwner),
      paidDriverLiability: String(policyDetails.legalLiabilityPaidDriver || '').toLowerCase() === 'yes',
      addons: Array.isArray(policyDetails.addonsSelected)
        ? policyDetails.addonsSelected.map((addon: any) => ({
            addonCode: typeof addon === 'string' ? addon : addon.addonCode || addon.code,
            ...(typeof addon === 'object' && addon.manualPrice !== undefined ? { manualPrice: Number(addon.manualPrice) } : {}),
          })).filter((addon: any) => addon.addonCode)
        : [],
      activeTpPolicyNumber: saodVerification.tpPolicyNumber || policyDetails.activeTPPolicyNumberValidity || undefined,
      activeTpExpiryDate: saodVerification.tpExpiryDate || undefined,
    };

    const calcResult = await this.motorCalculationService.calculate(calculationInput);

    const motorMetadata = {
      vehicleCategory: dto.vehicleCategory,
      policyType: dto.policyType,
      registrationNumber: dto.registrationNumber,
      proposerDetails: dto.proposerDetails,
      vehicleDetails: dto.vehicleDetails,
      policyDetails: dto.policyDetails,
      saodVerification: dto.saodVerification,
      documents: dto.documents,
      workflowStatus: 'READY_FOR_PROPOSAL',
      capturedBy: user.id,
      capturedAt: new Date().toISOString(),
    };

    const quotation = await this.prisma.quotation.create({
      data: {
        quotationCode,
        title: `Motor ${dto.vehicleCategory} — ${dto.policyType} | ${dto.registrationNumber || 'New Vehicle'}`,
        productType: 'MOTOR',
        insurerName: dto.insurerName,
        sumInsured: dto.idv || 0,
        basePremium: calcResult.outputs.baseOdPremium + calcResult.outputs.baseTpPremium,
        gstAmount: calcResult.outputs.totalGst,
        totalPremium: calcResult.outputs.totalPremium,
        ncbPercentage: calcResult.inputs.effectiveNcb,
        vehicleCategory: dto.vehicleCategory as any,
        policyType: dto.policyType,
        registrationNumber: dto.registrationNumber || null,
        policyTenure: calcResult.inputs.tpTenure,
        calculationSnapshot: calcResult as any,
        calculationVersion: calcResult.calculationVersion,
        rateConfigurationVersion: calcResult.rateConfigurationVersion,
        issuanceStatus: 'PROPOSAL_READY',
        motorMetadata,
        expiryDate: new Date(Date.now() + 30 * 86400000),
        contactId,
        leadId: dto.leadId || null,
        createdById: user.id,
      },
    });

    return {
      message: 'Motor insurance quote captured using authoritative backend pricing',
      quotationCode: quotation.quotationCode,
      id: quotation.id,
      vehicleCategory: quotation.vehicleCategory,
      policyType: quotation.policyType,
      registrationNumber: quotation.registrationNumber,
      totalPremium: Number(quotation.totalPremium),
      idv: Number(quotation.sumInsured),
      ncbPercentage: Number(quotation.ncbPercentage),
      status: 'READY_FOR_PROPOSAL',
      createdAt: quotation.createdAt,
    };
  }

  @SkipThrottle()
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT, RoleType.OPERATIONS, RoleType.POSP_ADVISOR, RoleType.RENEWAL_EXECUTIVE,
    RoleType.MD_CEO, RoleType.MARKETING_DIRECTOR, RoleType.UNDERWRITER, RoleType.CHIEF_FINANCE_OFFICER,
  )
  calculate(@Body() dto: any) {
    return this.comparisonEngine.generateComparativeQuotes(dto);
  }

  @SkipThrottle()
  @Post('enterprise-compare')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT, RoleType.OPERATIONS, RoleType.POSP_ADVISOR, RoleType.RENEWAL_EXECUTIVE,
    RoleType.MD_CEO, RoleType.MARKETING_DIRECTOR, RoleType.UNDERWRITER, RoleType.CHIEF_FINANCE_OFFICER,
  )
  @ApiOperation({ summary: 'Enterprise Multi-Insurer Quotation Gateway' })
  enterpriseCompare(@Body() dto: any) {
    return this.comparisonEngine.generateEnterpriseInsurerComparisons(dto);
  }

  /**
   * Retired intentionally. Motor issuance is now owned by POST /motor/quotes/:id/issue
   * and can only be executed after the backend workflow gate passes.
   */
  @Post('wizard/issue-policy')
  @HttpCode(HttpStatus.GONE)
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.SALES_MANAGER,
    RoleType.SALES_EXECUTIVE, RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE,
  )
  retiredMotorIssuanceEndpoint() {
    return {
      message: 'This issuance endpoint is retired. Use POST /motor/quotes/:id/issue after payment and workflow gates pass.',
    };
  }

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: RequestUser) {
    return this.generateQuotationService.execute(dto, user.id);
  }

  @Get()
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT, RoleType.OPERATIONS, RoleType.UNDERWRITER, RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE, RoleType.SUPPORT,
  )
  findAll(@CurrentUser() user: RequestUser, @Query() pagination: PaginationDto) {
    return this.getQuotationService.executeAll(user, pagination);
  }

  @Get(':id')
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT, RoleType.OPERATIONS, RoleType.UNDERWRITER, RoleType.CLAIMS_OFFICER,
    RoleType.FINANCE, RoleType.SUPPORT,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.getQuotationService.executeOne(id, user);
  }

  @Get(':id/history')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.OPERATIONS, RoleType.UNDERWRITER)
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.getQuotationHistoryService.execute(id);
  }

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS)
  compare(@Body('ids') ids: string[]) {
    return this.compareQuotationService.execute(ids);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  approve(@Param('id', ParseUUIDPipe) id: string, @Body('comments') comments: string, @CurrentUser() user: RequestUser) {
    return this.approveQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  reject(@Param('id', ParseUUIDPipe) id: string, @Body('comments') comments: string, @CurrentUser() user: RequestUser) {
    return this.rejectQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.SALES_AGENT)
  convert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.convertQuotationService.execute(id, user.id);
  }

  @Post(':id/accept')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.SALES_MANAGER,
    RoleType.OPERATIONS,
  )
  @ApiOperation({ summary: 'Customer accepts a quotation version (locks version, qualifies lead, supersedes competing drafts)' })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.acceptQuotationService.execute(id, user.id, comments);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.SALES_MANAGER,
  )
  @ApiOperation({ summary: 'Create an immutable revision version (V2, V3...) under an existing quotation' })
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateQuotationVersionInputDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.createQuotationVersionService.execute(id, dto, user.id);
  }

  @Get(':id/versions')
  @Roles(
    RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER, RoleType.SALES_AGENT, RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
  )
  @ApiOperation({ summary: 'List all revision version snapshots for a quotation' })
  async getVersions(@Param('id', ParseUUIDPipe) id: string) {
    return this.prisma.quotationVersion.findMany({
      where: { quotationId: id },
      orderBy: { versionNumber: 'desc' },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}
