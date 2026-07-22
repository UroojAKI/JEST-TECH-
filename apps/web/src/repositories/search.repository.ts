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
    return response.data;
  },
};
