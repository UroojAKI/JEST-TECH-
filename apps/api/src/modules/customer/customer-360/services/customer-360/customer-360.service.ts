import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';

@Injectable()
export class Customer360Service {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregates the Customer 360 Profile.
   * Note: In production, this response should be aggressively cached using Redis
   * (@nestjs/cache-manager) as it is computationally expensive.
   */
  async getCustomer360(contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        analytics: true,
        familyMembers: true,
        vehicles: true,
      },
    });

    if (!contact) {
      throw new NotFoundException('Customer not found');
    }

    // 1. Fetch Operational Data
    const activePoliciesPromise = this.prisma.policy.findMany({
      where: { contactId, status: 'ACTIVE' },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const openClaimsPromise = this.prisma.claim.findMany({
      where: { contactId, status: 'OPEN' }, // assuming 'OPEN' status exists
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    const recentCommsPromise = this.prisma.communicationLog.findMany({
      where: { contactId },
      take: 5,
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
        vehicles: contact.vehicles,
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
