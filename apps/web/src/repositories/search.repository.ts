import { apiClient } from '../lib/api-client';

export interface SearchResultItem {
  id: string;
  type: 'CUSTOMER' | 'POLICY' | 'CLAIM' | 'LEAD' | 'DOCUMENT';
  title: string;
  subtitle: string;
  link: string;
}

export const searchRepository = {
  async globalSearch(query: string): Promise<SearchResultItem[]> {
    if (!query || query.trim().length < 2) return [];
    const response = await apiClient.get('/search', {
      params: { q: query },
    });
    
    // The backend returns an object: { contacts: [], leads: [], policies: [], claims: [], proposals: [] }
    // We need to flatten this into SearchResultItem[]
    const data = response.data || {};
    const results: SearchResultItem[] = [];

    if (Array.isArray(data.contacts)) {
      data.contacts.forEach((c: any) => {
        results.push({
          id: c.id,
          type: 'CUSTOMER',
          title: `${c.firstName} ${c.lastName}`,
          subtitle: c.email || c.phone || c.contactCode,
          link: `/crm/contacts/${c.id}`,
        });
      });
    }

    if (Array.isArray(data.leads)) {
      data.leads.forEach((l: any) => {
        results.push({
          id: l.id,
          type: 'LEAD',
          title: l.title || l.leadCode || 'Lead',
          subtitle: `Status: ${l.status || 'NEW'}`,
          link: `/sales/leads`,
        });
      });
    }

    if (Array.isArray(data.policies)) {
      data.policies.forEach((p: any) => {
        results.push({
          id: p.id,
          type: 'POLICY',
          title: p.policyNumber,
          subtitle: `Status: ${p.status || 'ACTIVE'}`,
          link: `/policies/${p.id}`,
        });
      });
    }

    if (Array.isArray(data.claims)) {
      data.claims.forEach((c: any) => {
        results.push({
          id: c.id,
          type: 'CLAIM',
          title: c.claimNumber,
          subtitle: c.description || `Status: ${c.status || 'REPORTED'}`,
          link: `/portal/claims`,
        });
      });
    }

    return results;
  },
};
