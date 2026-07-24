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
    let response;
    if (status === 'UNDER_REVIEW') {
      response = await apiClient.post(`/claims/${id}/assign-surveyor`, { surveyorId: 'default' });
    } else if (status === 'APPROVED') {
      if (approvedAmount !== undefined) {
        await apiClient.post(`/claims/${id}/assess`, { assessmentAmount: approvedAmount, assessmentNotes: 'Auto assessed' });
      }
      response = await apiClient.post(`/claims/${id}/approve`, { approve: true, comments: 'Approved' });
    } else if (status === 'REJECTED') {
      response = await apiClient.post(`/claims/${id}/approve`, { approve: false, comments: 'Rejected' });
    } else if (status === 'PAID') {
      response = await apiClient.post(`/claims/${id}/pay`, { amount: approvedAmount || 0, paymentReference: 'CRM', paymentNotes: 'Paid' });
    } else {
      throw new Error('Unsupported status mapping');
    }
    return response.data;
  },
};
