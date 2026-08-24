import {
  Body,
  Controller,
  Delete,
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

import { GetQuotationService } from '../services/queries/get-quotation.service';
import { CompareQuotationService } from '../services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from '../services/queries/get-quotation-history.service';
import { ComparisonService } from '../engine/comparison.service';
import { PrismaService } from '../../../database/prisma.service';
import { PaginationDto } from '../../../common/pagination/pagination.dto';

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
    private readonly getQuotationService: GetQuotationService,
    private readonly compareQuotationService: CompareQuotationService,
    private readonly getQuotationHistoryService: GetQuotationHistoryService,
    private readonly comparisonEngine: ComparisonService,
    private readonly prisma: PrismaService,
  ) {}

  // -----------------------------------------------------------------------
  // Motor Insurance CRM — 8-Category Data Capture Form Save
  // POST /quotations/motor-capture
  // -----------------------------------------------------------------------
  @Post('motor-capture')
  @HttpCode(HttpStatus.CREATED)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.POSP_ADVISOR,
    RoleType.RENEWAL_EXECUTIVE,
  )
  @ApiOperation({ summary: 'Save Motor Insurance CRM data capture form (8 vehicle categories × 3 policy types)' })
  async motorCapture(
    @Body() dto: CreateMotorCaptureDto,
    @CurrentUser() user: RequestUser,
  ) {
    const quotationCode = `MQ-${dto.vehicleCategory?.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-8)}`;

    // Resolve contactId: from dto or find by leadId
    let contactId = dto.contactId;
    if (!contactId && dto.leadId) {
      const lead = await this.prisma.lead.findUnique({
        where: { id: dto.leadId },
        select: { contactId: true },
      });
      contactId = lead?.contactId || undefined;
    }

    // Attempt to match existing contact by proposer phone or email
    const proposer = dto.proposerDetails || {};
    if (!contactId && proposer['mobileNumber']) {
      const existingByPhone = await this.prisma.contact.findFirst({
        where: { phone: String(proposer['mobileNumber']).trim() },
        select: { id: true },
      });
      if (existingByPhone) contactId = existingByPhone.id;
    }

    if (!contactId && proposer['emailId']) {
      const existingByEmail = await this.prisma.contact.findFirst({
        where: { email: String(proposer['emailId']).trim() },
        select: { id: true },
      });
      if (existingByEmail) contactId = existingByEmail.id;
    }

    // If still no contactId, create a minimal contact from proposer details
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

    const totalPremium = dto.totalPremium || 0;
    const basePremium = totalPremium / 1.18; // strip GST
    const gstAmount = totalPremium - basePremium;

    const motorMetadata = {
      vehicleCategory: dto.vehicleCategory,
      policyType: dto.policyType,
      registrationNumber: dto.registrationNumber,
      proposerDetails: dto.proposerDetails,
      vehicleDetails: dto.vehicleDetails,
      policyDetails: dto.policyDetails,
      saodVerification: dto.saodVerification,
      documents: dto.documents,
      workflowStatus: dto.status,
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
        basePremium,
        gstAmount,
        totalPremium,
        ncbPercentage: dto.ncbPercentage || 0,
        vehicleCategory: dto.vehicleCategory as any,
        policyType: dto.policyType,
        registrationNumber: dto.registrationNumber || null,
        motorMetadata,
        expiryDate: new Date(Date.now() + 30 * 86400000),
        contactId,
        leadId: dto.leadId || null,
        createdById: user.id,
      },
    });

    return {
      message: 'Motor insurance quote captured successfully',
      quotationCode: quotation.quotationCode,
      id: quotation.id,
      vehicleCategory: quotation.vehicleCategory,
      policyType: quotation.policyType,
      registrationNumber: quotation.registrationNumber,
      totalPremium: Number(quotation.totalPremium),
      idv: Number(quotation.sumInsured),
      status: dto.status || quotation.status,
      createdAt: quotation.createdAt,
    };
  }

  @SkipThrottle()
  @Post('calculate')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.POSP_ADVISOR,
    RoleType.RENEWAL_EXECUTIVE,
    RoleType.MD_CEO,
    RoleType.MARKETING_DIRECTOR,
    RoleType.UNDERWRITER,
    RoleType.CHIEF_FINANCE_OFFICER,
  )
  calculate(@Body() dto: any) {
    return this.comparisonEngine.generateComparativeQuotes(dto);
  }

  @SkipThrottle()
  @Post('enterprise-compare')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
    RoleType.POSP_ADVISOR,
    RoleType.RENEWAL_EXECUTIVE,
    RoleType.MD_CEO,
    RoleType.MARKETING_DIRECTOR,
    RoleType.UNDERWRITER,
    RoleType.CHIEF_FINANCE_OFFICER,
  )
  @ApiOperation({ summary: 'Enterprise Multi-Insurer Quotation Gateway with Arbitrary Precision & SLA Fallback' })
  enterpriseCompare(@Body() dto: any) {
    return this.comparisonEngine.generateEnterpriseInsurerComparisons(dto);
  }


  @Post('wizard/issue-policy')

  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  @ApiOperation({ summary: 'Issue Motor Policy & Auto-Schedule Renewal Reminder' })
  async issuePolicyAndScheduleRenewal(
    @Body() dto: {
      contactId: string;
      leadId?: string;
      insurerName: string;
      totalPremium: number;
      registrationNumber?: string;
    },
    @CurrentUser() user: RequestUser
  ) {
    const policyNumber = `POL-${Date.now().toString().slice(-8)}`;
    const effectiveDate = new Date();
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    // Create or find dummy quotation to bind
    let quotationId = dto.leadId;
    if (!quotationId) {
      const q = await this.prisma.quotation.create({
        data: {
          quotationCode: `Q-${Date.now().toString().slice(-6)}`,
          title: `Motor Quote ${policyNumber}`,
          contactId: dto.contactId,
          insurerName: dto.insurerName || 'Partner Insurer',
          productType: 'MOTOR',
          sumInsured: 500000,
          basePremium: dto.totalPremium ? dto.totalPremium * 0.85 : 15000,
          gstAmount: dto.totalPremium ? dto.totalPremium * 0.15 : 2700,
          totalPremium: dto.totalPremium || 17700,
          expiryDate: new Date(Date.now() + 30 * 86400000),
          createdById: user.id,
        },
      });
      quotationId = q.id;
    }

    if (quotationId) {
      const qRec = await this.prisma.quotation.findUnique({ where: { id: quotationId } });
      if (qRec && !dto.contactId) {
        dto.contactId = qRec.contactId;
      }
    }

    if (!dto.contactId) {
      throw new Error('Contact ID is required to issue a policy.');
    }

    // 1. Issue Policy
    const policy = await this.prisma.policy.create({
      data: {
        policyNumber,
        status: 'ACTIVE',
        quotation: { connect: { id: quotationId } },
        contact: { connect: { id: dto.contactId } },
        premiumAmount: dto.totalPremium || 17700,
        effectiveDate,
        expiryDate,
        createdBy: { connect: { id: user.id } },
      },
    });

    // 2. Auto-Provision Renewal Task for Agent
    const renewalTask = await this.prisma.renewalTask.create({
      data: {
        policyId: policy.id,
        agentId: user.id,
        dueDate: expiryDate,
        status: 'PENDING',
        priority: 'HIGH',
      },
    });

    // 3. Update Lead Status if available
    if (dto.leadId) {
      await this.prisma.lead.update({
        where: { id: dto.leadId },
        data: {
          currentWorkflowStep: 'ISSUED',
          status: 'POLICY_ISSUED',
        },
      });
    }

    return {
      message: 'Policy issued successfully and renewal task auto-scheduled!',
      policy,
      renewalTask,
      downloadUrl: `/api/v1/policies/${policy.id}/document`,
    };
  }

  @Post()
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  create(@Body() dto: CreateQuotationDto, @CurrentUser() user: RequestUser) {
    return this.generateQuotationService.execute(dto, user.id);
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
  findAll(@CurrentUser() user: RequestUser, @Query() pagination: PaginationDto) {
    return this.getQuotationService.executeAll(user, pagination);
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
    return this.getQuotationService.executeOne(id, user);
  }

  @Get(':id/history')
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.OPERATIONS,
    RoleType.UNDERWRITER,
  )
  getHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.getQuotationHistoryService.execute(id);
  }

  @Post('compare')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
    RoleType.OPERATIONS,
  )
  compare(@Body('ids') ids: string[]) {
    return this.compareQuotationService.execute(ids);
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approveQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.rejectQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/convert')
  @HttpCode(HttpStatus.OK)
  @Roles(
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.BRANCH_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.SALES_AGENT,
  )
  convert(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.convertQuotationService.execute(id, user.id);
  }
}
