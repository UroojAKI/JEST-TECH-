import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';

export interface SearchResult {
  contacts: any[];
  leads: any[];
  policies: any[];
  claims: any[];
  proposals: any[];
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(query: string, companyId?: string): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      return {
        contacts: [],
        leads: [],
        policies: [],
        claims: [],
        proposals: [],
      };
    }

    if (!companyId) {
      throw new ForbiddenException('Tenant context is required for search');
    }

    const term = query.trim();

    const [contacts, leads, policies, claims, proposals] = await Promise.all([
      // Search Contacts
      this.prisma.contact.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { contactCode: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),

      // Search Leads
      this.prisma.lead.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { leadCode: { contains: term, mode: 'insensitive' } },
            { title: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),

      // Search Policies
      this.prisma.policy.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [{ policyNumber: { contains: term, mode: 'insensitive' } }],
        },
        take: 10,
      }),

      // Search Claims
      this.prisma.claim.findMany({
        where: {
          companyId,
          deletedAt: null,
          OR: [
            { claimNumber: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
        },
        take: 10,
      }),

      // Search Proposals
      this.prisma.proposal.findMany({
        where: {
          quotation: { companyId },
          OR: [{ proposalNumber: { contains: term, mode: 'insensitive' } }],
        },
        take: 10,
      }),
    ]);

    return {
      contacts,
      leads,
      policies,
      claims,
      proposals,
    };
  }
}
