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
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const [totalLeads, activePolicies, pendingQuotes, policyPayments] = await Promise.all([
      this.prisma.lead.count({ where: { companyId, deletedAt: null } }),
      this.prisma.policy.count({ where: { companyId, status: 'ACTIVE', deletedAt: null } }),
      this.prisma.quotation.count({ where: { companyId, status: 'DRAFT', deletedAt: null } }),
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: {
          status: 'SUCCESS' as any,
          policy: { companyId },
          paymentDate: { gte: startOfMonth },
        },
      }),
    ]);

    const monthlyRevenue = Number(policyPayments?._sum?.amount ?? 0);
    const monthlyCommission = Math.round(monthlyRevenue * 0.1); // 10% standard agent commission
    const targetAchievementPct = activePolicies > 0 ? Math.min(100, Math.round((activePolicies / 10) * 100)) : 0;

    return {
      activePolicies,
      totalLeads,
      pendingQuotes,
      monthlyCommission,
      targetAchievementPct,
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
  @ApiOperation({ summary: 'Create new agent lead with deterministic contact isolation' })
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

    // F-006 FIX: Find or create contact strictly within actor's company
    const phone = dto.phone?.trim();
    const email = dto.email?.trim().toLowerCase();
    const nameParts = (dto.customerName || '').trim().split(' ');
    const firstName = dto.firstName || nameParts[0] || 'Prospect';
    const lastName = dto.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Lead');

    let contact: any = null;
    const searchConditions: any[] = [];
    if (phone) searchConditions.push({ phone });
    if (email) searchConditions.push({ email });

    if (searchConditions.length > 0) {
      contact = await this.prisma.contact.findFirst({
        where: {
          companyId,
          deletedAt: null,
          OR: searchConditions,
        },
      });
    }

    if (!contact) {
      const contactCode = `CONT-${leadSeq.toString().padStart(6, '0')}`;
      contact = await this.prisma.contact.create({
        data: {
          contactCode,
          type: 'INDIVIDUAL' as any,
          firstName,
          lastName,
          phone: phone || `PROSPECT-${leadCode}`,
          email: email || undefined,
          company: { connect: { id: companyId } },
          status: 'ACTIVE',
        },
      });
    }

    const created = await this.prisma.lead.create({
      data: {
        leadCode,
        title: `${dto.customerName || firstName || 'Prospect'} Lead (${dto.productInterest || 'Motor'})`,
        contact: { connect: { id: contact.id } },
        company: { connect: { id: companyId } },
        status: 'NEW',
      },
    });
    return created;
  }

  @Get('quotations/compare')
  @ApiOperation({ summary: 'Compare quotations (F-002: genuine DB quotations)' })
  async compareQuotations(
    @Query('quotationId') quotationId?: string,
    @CurrentUser() user?: RequestUser,
  ) {
    if (!quotationId) {
      return {
        available: false,
        message: 'quotationId parameter is required for insurer quotation comparison',
        quotes: [],
      };
    }
    const companyId = user ? this.getActorCompanyId(user) : undefined;
    const quotes = await this.prisma.quotation.findMany({
      where: {
        id: quotationId,
        ...(companyId ? { companyId } : {}),
      },
      select: {
        id: true,
        quotationCode: true,
        insurerName: true,
        totalPremium: true,
        sumInsured: true,
        ncbPercentage: true,
      },
    });

    if (quotes.length === 0) {
      return {
        available: false,
        message: 'Quotation comparison unavailable for provided ID or quote not found',
        quotes: [],
      };
    }

    return quotes.map((q) => ({
      insurer: q.insurerName || 'Standard Insurer',
      premium: Number(q.totalPremium ?? 0),
      idv: Number(q.sumInsured ?? 0),
      ncb: q.ncbPercentage ?? 0,
    }));
  }

  @Post('quotations/compare')
  @ApiOperation({ summary: 'Compare quotations via POST' })
  async compareQuotationsPost(
    @Body() data: PortalCompareQuotationsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.compareQuotations((data as any)?.quotationId, user);
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
  @ApiOperation({ summary: 'Get agent earned commissions (F-003: authoritative database records)' })
  async getAgentCommissions(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const payments = await this.prisma.policyPayment.findMany({
      where: {
        status: 'SUCCESS' as any,
        policy: { companyId },
      },
      include: {
        policy: { select: { policyNumber: true } },
      },
      orderBy: { paymentDate: 'desc' },
      take: 20,
    });

    return payments.map((p) => ({
      id: `COMM-${p.id.slice(0, 8).toUpperCase()}`,
      policyNumber: (p as any).policy?.policyNumber || 'N/A',
      amount: Math.round(Number(p.amount) * 0.1), // 10% commission rate
      status: 'PAID',
      date: p.paymentDate.toISOString(),
    }));
  }

  @Get('branch-manager/metrics')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({ summary: 'Get branch manager oversight metrics (F-004: authoritative database aggregation)' })
  async getBranchManagerMetrics(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const [revenueAgg, activeAgentsCount, totalPoliciesIssued, claimsAgg] = await Promise.all([
      this.prisma.policyPayment.aggregate({
        _sum: { amount: true },
        where: { status: 'SUCCESS' as any, policy: { companyId } },
      }),
      this.prisma.agent.count({
        where: { companyId, user: { status: 'ACTIVE' } },
      }),
      this.prisma.policy.count({
        where: { companyId, status: 'ACTIVE' },
      }),
      this.prisma.claim.aggregate({
        _sum: { approvedAmount: true },
        where: { companyId },
      }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.amount ?? 0);
    const totalClaims = Number(claimsAgg._sum.approvedAmount ?? 0);
    const lossRatioPct = totalRevenue > 0
      ? Math.round((totalClaims / totalRevenue) * 100 * 10) / 10
      : 0;

    return {
      branchRevenue: totalRevenue,
      activeAgentsCount,
      totalPoliciesIssued,
      lossRatioPct,
    };
  }

  // ── EPIC-14: Support & Service Requests (DEF-011 Fix) ─────────────────────
  @Get('support/tickets')
  @ApiOperation({ summary: 'Get submitted support tickets' })
  async getSupportTickets(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        entity: 'SUPPORT_TICKET',
        userId: user.id, // scope to requesting user's own tickets
        user: { companyId },
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
