import { apiClient } from '../lib/api-client';
import { PaginatedResult } from '../types';

export interface EndorsementItem {
  id: string;
  policyId: string;
  policyNumber: string;
  category: 'FINANCIAL' | 'NON_FINANCIAL';
  type: string; // e.g. ADDRESS_CHANGE, NOMINEE_CHANGE, IDV_ADJUSTMENT, VEHICLE_TRANSFER
  reason: string;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  createdAt: string;
}

export const endorsementsRepository = {
  async getEndorsements(): Promise<EndorsementItem[]> {
    const response = await apiClient.get('/endorsements');
    return response.data;
  },

  async createEndorsement(policyId: string, category: 'FINANCIAL' | 'NON_FINANCIAL', type: string, reason: string): Promise<EndorsementItem> {
    const response = await apiClient.post('/endorsements', { policyId, category, type, reason });
    return response.data;
  },

  async approveEndorsement(id: string, comments: string): Promise<EndorsementItem> {
    const response = await apiClient.post(`/endorsements/${id}/approve`, { comments });
    return response.data;
  },
};
