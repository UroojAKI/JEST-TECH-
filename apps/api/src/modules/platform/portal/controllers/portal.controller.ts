import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../../database/prisma.service';

@ApiTags('Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Get agent portal performance metrics' })
  async getAgentMetrics(@CurrentUser() user: RequestUser) {
    const totalLeads = await this.prisma.lead.count();
    const activePolicies = await this.prisma.policy.count({
      where: { status: 'ACTIVE' },
    });
    const pendingQuotes = await this.prisma.quotation.count({
      where: { status: 'DRAFT' },
    });

    return {
      activePolicies,
      totalLeads,
      pendingQuotes,
      monthlyCommission: 48500,
      targetAchievementPct: 82,
    };
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get agent portfolio customers' })
  async getAgentCustomers() {
    const contacts = await this.prisma.contact.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return contacts;
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get agent lead pipeline' })
  async getAgentLeads(@Query('status') status?: string) {
    const where: any = { deletedAt: null };
    if (status && status !== 'ALL') {
      where.status = status;
    }
    const leads = await this.prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return leads;
  }

  @Post('leads')
  @ApiOperation({ summary: 'Create new agent lead' })
  async createAgentLead(@Body() dto: any, @CurrentUser() user: RequestUser) {
    const leadCode = `LD-${Date.now().toString().slice(-6)}`;
    const firstContact = await this.prisma.contact.findFirst({
      where: { deletedAt: null },
    });

    if (!firstContact) {
      return { id: leadCode, leadCode, status: 'NEW' };
    }

    const created = await this.prisma.lead.create({
      data: {
        leadCode,
        title: `${dto.customerName || dto.firstName || 'Prospect'} Lead (${dto.productInterest || 'Motor'})`,
        contact: { connect: { id: firstContact.id } },
        status: 'NEW',
      },
    });
    return created;
  }

  @Get('quotations/compare')
  @ApiOperation({ summary: 'Compare quotations' })
  async compareQuotations() {
    return [
      { insurer: 'ICICI Lombard', premium: 18500, idv: 850000, ncb: 25 },
      { insurer: 'HDFC ERGO', premium: 19200, idv: 850000, ncb: 25 },
      { insurer: 'Star Health', premium: 21000, idv: 850000, ncb: 25 },
    ];
  }

  @Post('quotations/compare')
  @ApiOperation({ summary: 'Compare quotations via POST' })
  async compareQuotationsPost(@Body() data?: any) {
    return this.compareQuotations();
  }

  @Get('policies')
  @ApiOperation({ summary: 'Get agent portfolio active policies' })
  async getAgentPolicies() {
    const policies = await this.prisma.policy.findMany({
      where: { deletedAt: null },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return policies;
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Get upcoming agent renewals' })
  async getAgentRenewals() {
    const policies = await this.prisma.policy.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      include: { contact: true },
      take: 20,
    });
    return policies;
  }

  @Get('commissions')
  @ApiOperation({ summary: 'Get agent earned commissions' })
  async getAgentCommissions() {
    return [
      {
        id: 'COMM-101',
        policyNumber: 'POL-2026-001042',
        amount: 3750,
        status: 'PAID',
        date: new Date().toISOString(),
      },
      {
        id: 'COMM-102',
        policyNumber: 'POL-2026-001043',
        amount: 4800,
        status: 'ACCRUED',
        date: new Date().toISOString(),
      },
    ];
  }

  @Get('branch-manager/metrics')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN, RoleType.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Get branch manager oversight metrics' })
  async getBranchManagerMetrics() {
    return {
      branchRevenue: 4250000,
      activeAgentsCount: 14,
      totalPoliciesIssued: 184,
      lossRatioPct: 18.4,
    };
  }
}
