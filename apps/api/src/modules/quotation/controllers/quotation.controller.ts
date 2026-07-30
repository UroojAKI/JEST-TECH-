import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
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
import { GenerateQuotationService } from '../services/commands/generate-quotation.service';
import { ApproveQuotationService } from '../services/commands/approve-quotation.service';
import { RejectQuotationService } from '../services/commands/reject-quotation.service';
import { ConvertQuotationService } from '../services/commands/convert-quotation.service';

import { GetQuotationService } from '../services/queries/get-quotation.service';
import { CompareQuotationService } from '../services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from '../services/queries/get-quotation-history.service';
import { ComparisonService } from '../engine/comparison.service';
import { PrismaService } from '../../../database/prisma.service';

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
  )
  calculate(@Body() dto: any) {
    return this.comparisonEngine.generateComparativeQuotes(dto);
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

    // 1. Issue Policy
    const policy = await this.prisma.policy.create({
      data: {
        policyNumber,
        status: 'ACTIVE',
        quotationId: quotationId,
        contactId: dto.contactId,
        premiumAmount: dto.totalPremium || 17700,
        effectiveDate,
        expiryDate,
        createdById: user.id,
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
  findAll(@CurrentUser() user: RequestUser) {
    return this.getQuotationService.executeAll(user);
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
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
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
  getHistory(@Param('id') id: string) {
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
    @Param('id') id: string,
    @Body('comments') comments: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.approveQuotationService.execute(id, comments, user.id);
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.UNDERWRITER)
  reject(
    @Param('id') id: string,
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
  convert(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.convertQuotationService.execute(id, user.id);
  }
}
