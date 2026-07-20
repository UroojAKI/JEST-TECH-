import { Injectable } from '@nestjs/common';
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

  async search(query: string): Promise<SearchResult> {
    if (!query || query.trim().length < 2) {
      return {
        contacts: [],
        leads: [],
        policies: [],
        claims: [],
        proposals: [],
      };
    }

    const term = query.trim();

    const [contacts, leads, policies, claims, proposals] = await Promise.all([
      // Search Contacts
      this.prisma.contact.findMany({
        where: {
          OR: [
            { firstName: { contains: term, mode: 'insensitive' } },
            { lastName: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            { phone: { contains: term, mode: 'insensitive' } },
            { contactCode: { contains: term, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        take: 10,
      }),

      // Search Leads
      this.prisma.lead.findMany({
        where: {
          OR: [
            { leadCode: { contains: term, mode: 'insensitive' } },
            { title: { contains: term, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        take: 10,
      }),

      // Search Policies
      this.prisma.policy.findMany({
        where: {
          OR: [{ policyNumber: { contains: term, mode: 'insensitive' } }],
          deletedAt: null,
        },
        take: 10,
      }),

      // Search Claims
      this.prisma.claim.findMany({
        where: {
          OR: [
            { claimNumber: { contains: term, mode: 'insensitive' } },
            { description: { contains: term, mode: 'insensitive' } },
          ],
          deletedAt: null,
        },
        take: 10,
      }),

      // Search Proposals
      this.prisma.proposal.findMany({
        where: {
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
