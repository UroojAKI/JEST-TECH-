import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ClaimStatus, PolicyStatus } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../../platform/cache/redis-cache.service';
import { ActorContext } from '../../../../../common/interfaces/actor-context.interface';
import { ResourceAuthorizationService } from '../../../../../common/services/resource-authorization.service';

@Injectable()
export class Customer360Service {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
    private readonly authzService: ResourceAuthorizationService,
  ) {}

  async getCustomer360(contactId: string, actor?: ActorContext) {
    const result = await this.buildCustomer360Profile(contactId, actor);
    return result;
  }

  async clearCustomer360Cache(contactId: string) {
    await this.cache.clear(`customer360:${contactId}`);
  }

  private async buildCustomer360Profile(
    contactId: string,
    actor?: ActorContext,
  ) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        analytics: true,
        familyMembers: true,
      },
    });

    if (!contact) {
      throw new NotFoundException('Customer not found');
    }

    if (actor) {
      this.authzService.authorize(actor, 'CUSTOMER_360', 'READ', contact);
    }

    // 1. Fetch Real Operational Data Concurrently
    const [policies, quotations, claims, comms, leads] = await Promise.all([
      this.prisma.policy.findMany({
        where: { contactId, deletedAt: null },
        include: { documents: true, claims: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.quotation.findMany({
        where: { contactId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.claim.findMany({
        where: { contactId, deletedAt: null },
        include: { policy: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.communicationLog.findMany({
        where: { contactId },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.lead.findMany({
        where: { contactId, deletedAt: null },
        include: { stageHistory: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // 2. Extract Real Vehicles
    const vehicleMap = new Map<string, any>();
    for (const p of policies) {
      if (p.vehicleId || p.policyNumber) {
        const meta = (p.motorMetadata as any) || {};
        const reg = meta.registrationNumber || p.policyNumber;
        if (!vehicleMap.has(reg)) {
          vehicleMap.set(reg, {
            registrationNumber: reg,
            make: meta.make || 'Vehicle',
            model: meta.model || p.policyType || 'Motor Policy',
            policyNumber: p.policyNumber,
            status: p.status,
            expiryDate: p.expiryDate,
          });
        }
      }
    }
    for (const q of quotations) {
      if (q.registrationNumber && !vehicleMap.has(q.registrationNumber)) {
        vehicleMap.set(q.registrationNumber, {
          registrationNumber: q.registrationNumber,
          make: 'Prospect Vehicle',
          model: q.title || 'Motor Quotation',
          quotationCode: q.quotationCode,
          status: 'PROSPECT',
          expiryDate: q.expiryDate,
        });
      }
    }

    // 3. Compute Real Financial Metrics
    const activePolicies = policies.filter(
      (p) => p.status === PolicyStatus.ACTIVE,
    );
    const totalPremiumPaid = policies
      .filter(
        (p) =>
          p.status === PolicyStatus.ACTIVE ||
          p.status === PolicyStatus.RENEWED ||
          p.status === PolicyStatus.LAPSED,
      )
      .reduce((sum, p) => sum + Number(p.premiumAmount || 0), 0);

    const openClaims = claims.filter(
      (c) =>
        c.status !== ClaimStatus.SETTLED &&
        c.status !== ClaimStatus.CLOSED &&
        c.status !== ClaimStatus.REJECTED,
    );

    const totalClaimsSettled = claims
      .filter((c) => c.status === ClaimStatus.SETTLED)
      .reduce(
        (sum, c) => sum + Number(c.approvedAmount || c.claimAmount || 0),
        0,
      );

    // 4. Assemble Unified Chronological Timeline
    const timeline: Array<{
      date: Date;
      type: string;
      title: string;
      description?: string;
      meta?: any;
    }> = [];

    for (const c of comms) {
      timeline.push({
        date: c.createdAt,
        type: 'COMMUNICATION',
        title: `${c.channel} - ${c.direction}`,
        description:
          c.messageBody ||
          c.messagePreview ||
          c.subject ||
          'Logged communication',
      });
    }

    for (const p of policies) {
      timeline.push({
        date: p.issueDate || p.createdAt,
        type: 'POLICY_ISSUANCE',
        title: `Policy ${p.policyNumber} Issued`,
        description: `Premium ₹${Number(p.premiumAmount).toLocaleString('en-IN')}`,
        meta: { policyId: p.id, status: p.status },
      });
    }

    for (const q of quotations) {
      timeline.push({
        date: q.createdAt,
        type: 'QUOTATION_CREATED',
        title: `Quotation ${q.quotationCode} Generated`,
        description: `Total Payable: ₹${Number(q.totalPremium).toLocaleString('en-IN')}`,
        meta: { quotationId: q.id, status: q.status },
      });
    }

    for (const cl of claims) {
      timeline.push({
        date: cl.incidentDate || cl.createdAt,
        type: 'CLAIM_FILED',
        title: `Claim ${cl.claimNumber} Filed`,
        description: `Amount: ₹${Number(cl.claimAmount).toLocaleString('en-IN')} - Status: ${cl.status}`,
        meta: { claimId: cl.id, status: cl.status },
      });
    }

    timeline.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    return {
      profile: {
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        phone: contact.phone,
        type: contact.type,
        panNumber: contact.panNumber || 'NOT_PROVIDED',
        aadhaarNumber: contact.aadhaarNumber
          ? `•••• •••• ${contact.aadhaarNumber.slice(-4)}`
          : 'NOT_PROVIDED',
      },
      analytics: {
        totalPremiumPaid,
        activePoliciesCount: activePolicies.length,
        totalPoliciesCount: policies.length,
        openClaimsCount: openClaims.length,
        totalClaimsSettled,
        healthScore: contact.analytics?.healthScore || 100,
        renewalProbability: contact.analytics?.renewalProbability || 95,
      },
      vehicles: Array.from(vehicleMap.values()),
      policies,
      quotations,
      claims,
      openClaims,
      timeline,
      familyMembers: contact.familyMembers,
    };
  }
}
