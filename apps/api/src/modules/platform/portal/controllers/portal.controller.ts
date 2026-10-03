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

  // Agent records are owner-scoped; privileged roles stay tenant-scoped.

  private getActorCompanyId(user: RequestUser): string {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Tenant organizational context is required');
    }
    return companyId;
  }

  private async getAgentScope(user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const roles = user.roles?.length ? user.roles : [user.role];
    const isAgent =
      roles.includes(RoleType.AGENT) &&
      !roles.includes(RoleType.ADMIN) &&
      !roles.includes(RoleType.BACK_OFFICE);
    const agent = isAgent
      ? await this.prisma.agent.findFirst({
          where: { userId: user.id, companyId, deletedAt: null },
          select: { id: true, agentCode: true },
        })
      : null;
    const agentId = agent?.id || user.agentId;

    const leadWhere: any = { companyId, deletedAt: null };
    if (isAgent) {
      leadWhere.OR = [
        ...(agentId ? [{ agentId }] : []),
        { assignedToId: user.id },
        { createdById: user.id },
      ];
    }

    const contactWhere: any = { companyId, deletedAt: null };
    const quotationWhere: any = { companyId, deletedAt: null };
    const policyWhere: any = { companyId, deletedAt: null };
    const claimWhere: any = { companyId, deletedAt: null };
    if (isAgent) {
      contactWhere.OR = [
        { createdById: user.id },
        ...(agent?.agentCode ? [{ agentCode: agent.agentCode }] : []),
        { leads: { some: leadWhere } },
      ];
      quotationWhere.OR = [
        ...(agentId ? [{ agentId }] : []),
        { createdById: user.id },
        { lead: { is: leadWhere } },
      ];
      policyWhere.OR = [
        ...(agentId ? [{ agentId }] : []),
        { createdById: user.id },
        { quotation: { is: { lead: { is: leadWhere } } } },
      ];
      claimWhere.OR = [
        ...(agentId ? [{ agentId }] : []),
        { createdById: user.id },
        { policy: { is: { quotation: { is: { lead: { is: leadWhere } } } } } },
      ];
    }

    return {
      companyId,
      agent,
      agentId,
      leadWhere,
      contactWhere,
      quotationWhere,
      policyWhere,
      claimWhere,
    };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get agent portal performance metrics' })
  async getAgentMetrics(@CurrentUser() user: RequestUser) {
    const { companyId, leadWhere, quotationWhere, policyWhere, claimWhere } =
      await this.getAgentScope(user);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfMonth = new Date(
      now.getFullYear(),
      now.getMonth(),
      1,
    );
    const endOfRenewalWindow = new Date(now);
    endOfRenewalWindow.setDate(now.getDate() + 45);

    const [totalLeads, todaysLeads, activePolicies, pendingQuotes, renewalsDue, claimsPending, inspectionsPending, issuedThisMonth, policyPayments] =
      await Promise.all([
        this.prisma.lead.count({ where: leadWhere }),
        this.prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: startOfToday } } }),
        this.prisma.policy.count({
          where: { ...policyWhere, status: 'ACTIVE' },
        }),
        this.prisma.quotation.count({
          where: { ...quotationWhere, status: 'DRAFT' },
        }),
        this.prisma.policy.count({
          where: {
            ...policyWhere,
            status: 'ACTIVE',
            expiryDate: { gte: now, lte: endOfRenewalWindow },
          },
        }),
        this.prisma.claim.count({
          where: {
            ...claimWhere,
            status: { notIn: ['SETTLED', 'CLOSED', 'REJECTED'] as any },
          },
        }),
        this.prisma.motorInspection.count({
          where: {
            companyId,
            status: { notIn: ['COMPLETED', 'WAIVED', 'NOT_REQUIRED'] as any },
            quotation: { is: quotationWhere },
          },
        }),
        this.prisma.policy.count({
          where: { ...policyWhere, status: 'ACTIVE', createdAt: { gte: startOfMonth } },
        }),
        this.prisma.policyPayment.aggregate({
          _sum: { amount: true },
          where: {
            status: 'SUCCESS' as any,
            policy: { is: { ...policyWhere, companyId } },
            paymentDate: { gte: startOfMonth },
          },
        }),
      ]);

    const monthlyRevenue = Number(policyPayments?._sum?.amount ?? 0);
    const monthlyCommission = Math.round(monthlyRevenue * 0.1); // 10% standard agent commission
    const targetAchievementPct = Math.min(100, Math.round((issuedThisMonth / 10) * 100));

    return {
      activePolicies,
      totalLeads,
      todaysLeads,
      pendingQuotes,
      policiesIssued: activePolicies,
      renewalsDue,
      claimsPending,
      inspectionsPending,
      commissionEarned: monthlyCommission,
      monthlyTargetAchievementPercent: targetAchievementPct,
      leaderboardRank: 0,
      branchName: 'Registered Branch Network',
    };
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get agent portfolio customers' })
  async getAgentCustomers(
    @CurrentUser() user: RequestUser,
    @Query('search') search?: string,
  ) {
    const { contactWhere, leadWhere, policyWhere } = await this.getAgentScope(user);
    const where: any = { ...contactWhere };
    if (search?.trim()) {
      where.AND = [{
        OR: [
          { firstName: { contains: search.trim(), mode: 'insensitive' } },
          { lastName: { contains: search.trim(), mode: 'insensitive' } },
          { phone: { contains: search.trim() } },
          { email: { contains: search.trim(), mode: 'insensitive' } },
          { contactCode: { contains: search.trim(), mode: 'insensitive' } },
        ],
      }];
    }
    const contacts = await this.prisma.contact.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        policies: {
          where: policyWhere,
          select: { id: true, status: true, premiumAmount: true },
        },
        leads: {
          where: leadWhere,
          select: { id: true, leadCode: true, updatedAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return contacts.map((contact) => ({
      id: contact.id,
      contactCode: contact.contactCode,
      name: `${contact.firstName} ${contact.lastName}`.trim(),
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      mobile: contact.phone,
      email: contact.email,
      city: contact.branch?.name || '',
      activePoliciesCount: contact.policies.filter((policy) => policy.status === 'ACTIVE').length,
      totalGwp: contact.policies.reduce((sum, policy) => sum + Number(policy.premiumAmount || 0), 0),
      lastInteraction: contact.leads.reduce(
        (latest, lead) => (lead.updatedAt > latest ? lead.updatedAt : latest),
        contact.updatedAt,
      ),
      leadCodes: contact.leads.map((lead) => lead.leadCode),
    }));
  }

  @Get('leads')
  @ApiOperation({ summary: 'Get agent lead pipeline' })
  async getAgentLeads(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
  ) {
    const { companyId, leadWhere } = await this.getAgentScope(user);
    const where: any = { ...leadWhere, companyId };
    if (status && status !== 'ALL') {
      const statusMap: Record<string, string[]> = {
        QUOTE_SENT: ['QUOTE_PREPARED', 'QUOTATION', 'CUSTOMER_ACCEPTED', 'PAYMENT_PENDING'],
        ISSUED: ['POLICY_ISSUED', 'CONVERTED'],
      };
      where.status = { in: statusMap[status] || [status] };
    }
    const leads = await this.prisma.lead.findMany({
      where,
      include: {
        contact: { select: { id: true, contactCode: true, firstName: true, lastName: true, phone: true } },
        quotations: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            case: { select: { id: true, caseCode: true, status: true, selectedQuoteId: true } },
            motorInspection: { select: { inspectionCode: true, status: true } },
            motorPaymentRecord: { select: { status: true, referenceNumber: true } },
            policy: { select: { policyNumber: true, status: true, claims: { select: { claimNumber: true, status: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return leads.map((lead) => {
      const latest = lead.quotations[0];
      const issuedPolicy = lead.quotations.find((quote) => quote.policy)?.policy;
      const status = issuedPolicy || lead.status === 'POLICY_ISSUED' || lead.status === 'CONVERTED'
        ? 'ISSUED'
        : latest?.motorPaymentRecord?.status === 'UNDER_PROCESS' || latest?.motorPaymentRecord?.status === 'PAID'
          ? 'PAYMENT'
          : lead.status === 'NEGOTIATION'
            ? 'NEGOTIATION'
            : lead.quotations.length > 0 || ['QUOTE_PREPARED', 'QUOTATION', 'CUSTOMER_ACCEPTED', 'PAYMENT_PENDING'].includes(lead.status)
              ? 'QUOTE_SENT'
              : lead.status;

      return {
        id: lead.id,
        leadCode: lead.leadCode,
        contactId: lead.contact.id,
        contactCode: lead.contact.contactCode,
        customerName: `${lead.contact.firstName} ${lead.contact.lastName}`.trim(),
        mobile: lead.contact.phone,
        productLine: lead.title,
        estimatedGwp: Number(lead.estimatedPremium || latest?.totalPremium || 0),
        status,
        leadStatus: lead.status,
        createdAt: lead.createdAt,
        quotationCount: lead.quotations.length,
        quotationCode: latest?.quotationCode,
        caseCode: latest?.case?.caseCode,
        inspectionCode: latest?.motorInspection?.inspectionCode,
        inspectionStatus: latest?.motorInspection?.status || latest?.workflowState || 'NOT_STARTED',
        paymentStatus: latest?.motorPaymentRecord?.status || 'NOT_DONE',
        paymentReference: latest?.motorPaymentRecord?.referenceNumber,
        policyNumber: issuedPolicy?.policyNumber,
        claims: lead.quotations.flatMap((quote) => quote.policy?.claims || []),
      };
    });
  }

  @Post('leads')
  @ApiOperation({
    summary: 'Create new agent lead with deterministic contact isolation',
  })
  async createAgentLead(
    @Body() dto: CreatePortalLeadDto,
    @CurrentUser() user: RequestUser,
  ) {
    const { companyId, agent } = await this.getAgentScope(user);
    let leadSeq: bigint;
    try {
      const res = await this.prisma.$queryRaw<
        [{ nextval: bigint }]
      >`SELECT nextval('lead_number_seq')`;
      leadSeq = res[0].nextval;
    } catch {
      await this.prisma
        .$executeRaw`CREATE SEQUENCE IF NOT EXISTS lead_number_seq START 1;`;
      const res = await this.prisma.$queryRaw<
        [{ nextval: bigint }]
      >`SELECT nextval('lead_number_seq')`;
      leadSeq = res[0].nextval;
    }
    const leadCode = `LEAD-${leadSeq.toString().padStart(6, '0')}`;

    // F-006 FIX: Find or create contact strictly within actor's company
    const phone = dto.phone?.trim();
    const email = dto.email?.trim().toLowerCase();
    const nameParts = (dto.customerName || '').trim().split(' ');
    const firstName = dto.firstName || nameParts[0] || 'Prospect';
    const lastName =
      dto.lastName ||
      (nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'Lead');

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
          createdById: user.id,
          agentCode: agent?.agentCode,
          companyId,
          status: 'ACTIVE',
        },
      });
    }

    const created = await this.prisma.lead.create({
      data: {
        leadCode,
        title: `${dto.customerName || firstName || 'Prospect'} Lead (${dto.productInterest || 'Motor'})`,
        description: dto.notes?.trim() || undefined,
        contact: { connect: { id: contact.id } },
        company: { connect: { id: companyId } },
        status: 'NEW',
        agent: agent ? { connect: { id: agent.id } } : undefined,
        assignedTo: { connect: { id: user.id } },
        createdBy: { connect: { id: user.id } },
      },
      include: {
        contact: { select: { id: true, contactCode: true, firstName: true, lastName: true, phone: true } },
      },
    });
    return {
      ...created,
      contactId: created.contact.id,
      contactCode: created.contact.contactCode,
      customerName: `${created.contact.firstName} ${created.contact.lastName}`.trim(),
      mobile: created.contact.phone,
      productLine: created.title,
      estimatedGwp: 0,
    };
  }

  @Get('quotations/compare')
  @ApiOperation({
    summary: 'Compare quotations (F-002: genuine DB quotations)',
  })
  async compareQuotations(
    @CurrentUser() user: RequestUser,
    @Query('quotationId') quotationId?: string,
  ) {
    if (!quotationId) {
      return {
        available: false,
        message:
          'quotationId parameter is required for insurer quotation comparison',
        quotes: [],
      };
    }
    const { companyId, quotationWhere } = await this.getAgentScope(user);
    const quotes = await this.prisma.quotation.findMany({
      where: {
        id: quotationId,
        ...quotationWhere,
        companyId,
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
        message:
          'Quotation comparison unavailable for provided ID or quote not found',
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
    return this.compareQuotations(user, (data as any)?.quotationId);
  }

  @Get('policies')
  @ApiOperation({ summary: 'Get agent portfolio active policies' })
  async getAgentPolicies(@CurrentUser() user: RequestUser) {
    const { companyId, policyWhere } = await this.getAgentScope(user);
    const policies = await this.prisma.policy.findMany({
      where: { ...policyWhere, companyId },
      include: {
        contact: { select: { id: true, contactCode: true, firstName: true, lastName: true } },
        quotation: {
          select: {
            quotationCode: true,
            productType: true,
            insurerName: true,
            case: { select: { caseCode: true } },
            motorInspection: { select: { status: true } },
            motorPaymentRecord: { select: { status: true } },
          },
        },
        claims: { select: { claimNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return policies.map((policy) => ({
      id: policy.id,
      policyNumber: policy.policyNumber,
      contactId: policy.contact.id,
      contactCode: policy.contact.contactCode,
      customerName: `${policy.contact.firstName} ${policy.contact.lastName}`.trim(),
      productLine: policy.quotation.productType || policy.policyType || 'Insurance',
      insurerName: policy.quotation.insurerName || '—',
      totalPremium: Number(policy.premiumAmount || 0),
      startDate: policy.effectiveDate.toISOString(),
      expiryDate: policy.expiryDate.toISOString(),
      status: policy.status,
      quotationCode: policy.quotation.quotationCode,
      caseCode: policy.quotation.case?.caseCode,
      inspectionStatus: policy.quotation.motorInspection?.status || 'NOT_REQUIRED',
      paymentStatus: policy.quotation.motorPaymentRecord?.status || 'NOT_RECORDED',
      claims: policy.claims,
    }));
  }

  @Get('renewals')
  @ApiOperation({ summary: 'Get upcoming agent renewals' })
  async getAgentRenewals(
    @CurrentUser() user: RequestUser,
    @Query('bucket') bucket?: string,
  ) {
    const { companyId, policyWhere } = await this.getAgentScope(user);
    const now = new Date();
    const graceStart = new Date(now);
    graceStart.setDate(now.getDate() - 30);
    const renewalEnd = new Date(now);
    renewalEnd.setDate(now.getDate() + 45);
    const policies = await this.prisma.policy.findMany({
      where: {
        ...policyWhere,
        companyId,
        status: 'ACTIVE',
        expiryDate: { gte: graceStart, lte: renewalEnd },
      },
      include: {
        contact: { select: { id: true, firstName: true, lastName: true, phone: true } },
        quotation: { select: { productType: true } },
      },
      orderBy: { expiryDate: 'asc' },
      take: 20,
    });
    return policies
      .map((policy) => {
        const daysRemaining = Math.ceil((policy.expiryDate.getTime() - now.getTime()) / 86_400_000);
        const renewalBucket = daysRemaining < 0
          ? 'GRACE'
          : daysRemaining <= 7
            ? '7_DAYS'
            : daysRemaining <= 15
              ? '15_DAYS'
              : daysRemaining <= 30
                ? '30_DAYS'
                : '45_DAYS';
        return {
          id: policy.id,
          policyNumber: policy.policyNumber,
          contactId: policy.contact.id,
          customerName: `${policy.contact.firstName} ${policy.contact.lastName}`.trim(),
          mobile: policy.contact.phone,
          productLine: policy.quotation.productType || policy.policyType || 'Insurance',
          expiryDate: policy.expiryDate.toISOString(),
          daysRemaining,
          bucket: renewalBucket,
          previousPremium: Number(policy.premiumAmount || 0),
          renewalQuoteReady: false,
        };
      })
      .filter((policy) => !bucket || bucket === policy.bucket);
  }

  @Get('commissions')
  @ApiOperation({
    summary:
      'Get agent earned commissions (F-003: authoritative database records)',
  })
  async getAgentCommissions(@CurrentUser() user: RequestUser) {
    const { companyId, policyWhere } = await this.getAgentScope(user);
    const payments = await this.prisma.policyPayment.findMany({
      where: {
        status: 'SUCCESS' as any,
        policy: { is: { ...policyWhere, companyId } },
      },
      include: {
        policy: {
          select: {
            policyNumber: true,
            premiumAmount: true,
            contact: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
      take: 20,
    });

    return payments.map((p) => ({
      id: `COMM-${p.id.slice(0, 8).toUpperCase()}`,
      policyNumber: (p as any).policy?.policyNumber || 'N/A',
      customerName: `${p.policy.contact.firstName} ${p.policy.contact.lastName}`.trim(),
      totalPremium: Number(p.policy.premiumAmount || 0),
      commissionRate: 0.1,
      amount: Math.round(Number(p.amount) * 0.1), // 10% commission rate
      earnedAmount: Math.round(Number(p.amount) * 0.1),
      payoutStatus: 'PAID',
      transactionDate: p.paymentDate.toISOString(),
    }));
  }

  @Get('branch-manager/metrics')
  @Roles(RoleType.ADMIN, RoleType.BACK_OFFICE)
  @ApiOperation({
    summary:
      'Get branch manager oversight metrics (F-004: authoritative database aggregation)',
  })
  async getBranchManagerMetrics(@CurrentUser() user: RequestUser) {
    const companyId = this.getActorCompanyId(user);
    const [revenueAgg, activeAgentsCount, totalPoliciesIssued, claimsAgg] =
      await Promise.all([
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
    const lossRatioPct =
      totalRevenue > 0
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
