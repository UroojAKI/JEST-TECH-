import { apiClient } from '../lib/api-client';
import { PaginatedResult } from '../types';

export interface EndorsementItem {
  id: string;
  endorsementNumber?: string;
  policyId: string;
  policyNumber?: string;
  type: string; // e.g. CONTACT_CHANGE, ADDRESS_CHANGE, VEHICLE_CHANGE, OWNER_TRANSFER, PREMIUM_CHANGE, etc.
  reason: string;
  requestedChanges?: Record<string, any>;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'APPLIED' | 'REJECTED';
  createdAt: string;
}

export const endorsementsRepository = {
  async getEndorsements(): Promise<EndorsementItem[]> {
    const response = await apiClient.get('/endorsements');
    return response.data?.data || response.data || [];
  },

  async createEndorsement(
    policyId: string,
    type: string,
    reason: string,
    requestedChanges?: Record<string, any>,
  ): Promise<EndorsementItem> {
    const response = await apiClient.post('/endorsements', {
      policyId,
      type,
      reason,
      requestedChanges: requestedChanges || {},
    });
    return response.data;
  },

  async approveEndorsement(id: string, comments: string): Promise<EndorsementItem> {
    const response = await apiClient.post(`/endorsements/${id}/approve`, { comments });
    return response.data;
  },

  async calculateProRata(policyId: string, newAnnualPremium: number) {
    const response = await apiClient.post(`/endorsements/policies/${policyId}/calculate-prorata`, {
      newAnnualPremium,
    });
    return response.data;
  },
};
