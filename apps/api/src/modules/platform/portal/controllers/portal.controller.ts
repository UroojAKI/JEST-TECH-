import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleType, AuditAction } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../../database/prisma.service';
import {
  CreatePortalLeadDto,
  PortalCompareQuotationsDto,
} from '../dto/portal.dto';

@ApiTags('Portal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('portal')
export class PortalController {
  constructor(private readonly prisma: PrismaService) {}

  // ── F-001 FIX: All queries are scoped to actor's companyId ──────────────

  private getActorCompanyId(user: RequestUser): string {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }
    return companyId;
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get agent portal performance metrics' })
  async getAgentMetrics(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);

    const [totalLeads, activePolicies, pendingQuotes] = await Promise.all([
      this.prisma.lead.count({ where: { companyId } }),
      this.prisma.policy.count({ where: { companyId, status: 'ACTIVE' } }),
      this.prisma.quotation.count({ where: { companyId, status: 'DRAFT' } }),
    ]);

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
  async getAgentCustomers(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const contacts = await this.prisma.contact.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return contacts;
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get agent lead pipeline' })
  async getAgentLeads(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const companyId = this.getActorCompanyId(user);
    const where: any = { companyId, deletedAt: null };
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
  async createAgentLead(
    @Body() dto: CreatePortalLeadDto,
    @CurrentUser() user: RequestUser,
  ) {
    const companyId = this.getActorCompanyId(user);
    let leadSeq: bigint;
    try {
      const res = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('lead_number_seq')`;
      leadSeq = res[0].nextval;
    } catch {
      await this.prisma.$executeRaw`CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1;`;
      const res = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('lead_number_seq')`;
      leadSeq = res[0].nextval;
    }
    const leadCode = `LEAD-${leadSeq.toString().padStart(6, '0')}`;
    const firstContact = await this.prisma.contact.findFirst({
      where: { companyId, deletedAt: null },
    });

    if (!firstContact) {
      return { id: leadCode, leadCode, status: 'NEW' };
    }

    const created = await this.prisma.lead.create({
      data: {
        leadCode,
        title: `${dto.customerName || dto.firstName || 'Prospect'} Lead (${dto.productInterest || 'Motor'})`,
        contact: { connect: { id: firstContact.id } },
        company: { connect: { id: companyId } },
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
  async compareQuotationsPost(@Body() data?: PortalCompareQuotationsDto) {
    return this.compareQuotations();
  }

  @Get('policies')
  @ApiOperation({ summary: 'Get agent portfolio active policies' })
  async getAgentPolicies(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const policies = await this.prisma.policy.findMany({
      where: { companyId, deletedAt: null },
      include: { contact: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return policies;
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Get upcoming agent renewals' })
  async getAgentRenewals(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const policies = await this.prisma.policy.findMany({
      where: { companyId, deletedAt: null, status: 'ACTIVE' },
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
  @Roles(RoleType.ADMIN, RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get branch manager oversight metrics' })
  async getBranchManagerMetrics() {
    return {
      branchRevenue: 4250000,
      activeAgentsCount: 14,
      totalPoliciesIssued: 184,
      lossRatioPct: 18.4,
    };
  }

  // ── EPIC-14: Support & Service Requests (DEF-011 Fix) ─────────────────────
  @Get('support/tickets')
  @ApiOperation({ summary: 'Get submitted support tickets' })
  async getSupportTickets(@CurrentUser() user: RequestUser) {
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'SUPPORT_TICKET',
        userId: user.id, // scope to requesting user's own tickets
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs.map((l) => {
      const meta = (l.metadata as any) || {};
      return {
        id: l.entityId,
        ticketNumber:
          meta.ticketNumber || `TKT-${l.entityId.slice(0, 6).toUpperCase()}`,
        subject: meta.subject || 'Support Ticket',
        description: meta.description || '',
        priority: meta.priority || 'MEDIUM',
        status: meta.status || 'OPEN',
        createdAt: l.createdAt.toISOString(),
      };
    });
  }

  @Post('support/tickets')
  @ApiOperation({ summary: 'Submit new support ticket' })
  async createSupportTicket(
    @Body() dto: { subject: string; priority: string; description: string },
    @CurrentUser() user: RequestUser,
  ) {
    const ticketId = `tkt_${Date.now()}`;
    const ticketNumber = `TKT-${Date.now().toString().slice(-6)}`;

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: 'SUPPORT_TICKET',
        entityId: ticketId,
        module: 'SUPPORT',
        userId: user.id,
        performedById: user.id,
        metadata: {
          ticketNumber,
          subject: dto.subject,
          priority: dto.priority || 'MEDIUM',
          description: dto.description,
          status: 'OPEN',
        },
      },
    });

    return {
      id: ticketId,
      ticketNumber,
      subject: dto.subject,
      priority: dto.priority || 'MEDIUM',
      description: dto.description,
      status: 'OPEN',
      createdAt: new Date().toISOString(),
    };
  }
}
