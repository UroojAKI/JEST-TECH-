import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface Policy {
  id: string;
  policyNumber: string;
  contactId: string;
  productType: string;
  insurerName: string;
  premiumAmount: number;
  status: 'ACTIVE' | 'LAPSED' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  endDate: string;
  createdById: string;
}

export const policiesRepository = {
  async getPolicies(params?: PaginationParams): Promise<PaginatedResult<Policy>> {
    const response = await apiClient.get('/policies', { params });
    return response.data;
  },

  async getPolicyById(id: string): Promise<Policy> {
    const response = await apiClient.get(`/policies/${id}`);
    return response.data;
  },

  async issuePolicy(quotationId: string): Promise<Policy> {
    const response = await apiClient.post('/policies/issue', { quotationId });
    return response.data;
  },

  async renewPolicy(policyId: string): Promise<Policy> {
    const response = await apiClient.post(`/policies/${policyId}/renew`);
    return response.data;
  },
};
