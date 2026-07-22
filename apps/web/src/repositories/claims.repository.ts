import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  contactId: string;
  claimAmount: number;
  approvedAmount?: number;
  status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID';
  incidentDate: string;
  description: string;
}

export const claimsRepository = {
  async getClaims(params?: PaginationParams): Promise<PaginatedResult<Claim>> {
    const response = await apiClient.get('/claims', { params });
    return response.data;
  },

  async getClaimById(id: string): Promise<Claim> {
    const response = await apiClient.get(`/claims/${id}`);
    return response.data;
  },

  async createClaim(data: Partial<Claim>): Promise<Claim> {
    const response = await apiClient.post('/claims', data);
    return response.data;
  },

  async updateClaimStatus(id: string, status: string, approvedAmount?: number): Promise<Claim> {
    const response = await apiClient.patch(`/claims/${id}/status`, { status, approvedAmount });
    return response.data;
  },
};
