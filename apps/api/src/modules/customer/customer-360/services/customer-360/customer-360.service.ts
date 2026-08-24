import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ClaimStatus } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../../platform/cache/redis-cache.service';

@Injectable()
export class Customer360Service {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
  ) {}

  async getCustomer360(contactId: string) {
    const cacheKey = `customer360:${contactId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const result = await this.buildCustomer360Profile(contactId);
    await this.cache.set(cacheKey, result, 600); // 10 min TTL
    return result;
  }

  async clearCustomer360Cache(contactId: string) {
    await this.cache.clear(`customer360:${contactId}`);
  }

  private async buildCustomer360Profile(contactId: string) {
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

    // 1. Fetch Operational Data
    const activePoliciesPromise = this.prisma.policy.findMany({
      where: { contactId, status: 'ACTIVE' },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const openClaimsPromise = this.prisma.claim.findMany({
      where: {
        contactId,
        status: {
          notIn: [ClaimStatus.SETTLED, ClaimStatus.CLOSED, ClaimStatus.REJECTED],
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    const recentCommsPromise = this.prisma.communicationLog.findMany({
      where: { contactId },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });

    const [activePolicies, openClaims, recentComms] = await Promise.all([
      activePoliciesPromise,
      openClaimsPromise,
      recentCommsPromise,
    ]);

    // 2. Assemble 360 View
    return {
      profile: {
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        phone: contact.phone,
        type: contact.type,
      },
      analytics: contact.analytics || {
        lifetimeValue: 0,
        renewalProbability: 0,
        customerRiskScore: 0,
        healthScore: 100,
        churnProbability: 0,
      },
      assets: {
        family: contact.familyMembers,
      },
      operational: {
        activePolicies,
        openClaims,
      },
      timeline: {
        recentCommunications: recentComms,
      },
    };
  }
}
