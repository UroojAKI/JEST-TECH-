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

  async approveClaim(id: string, data: { approvedAmount: number; comments?: string }): Promise<Claim> {
    const response = await apiClient.post(`/claims/${id}/approve`, data);
    return response.data;
  },

  async settleClaim(id: string, data: { settlementAmount: number; paymentReference: string; paymentMethod: string; bankName?: string; comments?: string }): Promise<Claim> {
    const response = await apiClient.post(`/claims/${id}/settle`, data);
    return response.data;
  },

  async rejectClaim(id: string, data: { reason: string; comments?: string }): Promise<Claim> {
    const response = await apiClient.post(`/claims/${id}/reject`, data);
    return response.data;
  },

  async updateClaimStatus(id: string, status: string, approvedAmount?: number): Promise<Claim> {
    let response;
    if (status === 'UNDER_REVIEW') {
      response = await apiClient.post(`/claims/${id}/assign-surveyor`, { surveyorId: 'default' });
    } else if (status === 'APPROVED') {
      response = await apiClient.post(`/claims/${id}/approve`, { approvedAmount: approvedAmount || 10000, comments: 'Approved' });
    } else if (status === 'REJECTED') {
      response = await apiClient.post(`/claims/${id}/reject`, { reason: 'Claim rejected by underwriter', comments: 'Rejected' });
    } else if (status === 'PAID' || status === 'SETTLED') {
      response = await apiClient.post(`/claims/${id}/settle`, {
        settlementAmount: approvedAmount || 10000,
        paymentReference: `SETTLE_${Date.now()}`,
        paymentMethod: 'NEFT',
        comments: 'Settled',
      });
    } else {
      throw new Error('Unsupported status mapping');
    }
    return response.data;
  },
};
