import { apiClient } from '../lib/api-client';
import { PaginatedResult } from '../types';

export interface EndorsementItem {
  id: string;
  endorsementNumber?: string;
  policyId: string;
  policyNumber?: string;
  type: string; // e.g. GENERAL_CHANGE, CONTACT_CHANGE, ADDRESS_CHANGE, VEHICLE_CHANGE, OWNER_TRANSFER, etc.
  reason: string;
  requestedChanges?: Record<string, any> | any;
  beforeSnapshot?: Record<string, any> | any;
  validatedChanges?: Record<string, any> | any;
  baseVersion?: number;
  rejectionReason?: string | null;
  requestedById?: string;
  requestedBy?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
  status: 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'APPLIED' | 'COMPLETED' | 'REJECTED' | string;
  createdAt: string;
}

export const endorsementsRepository = {
  async getEndorsements(): Promise<EndorsementItem[]> {
    const response = await apiClient.get('/endorsements');
    return response.data?.data || response.data || [];
  },

  async getEndorsementDetails(id: string): Promise<EndorsementItem> {
    const response = await apiClient.get(`/endorsements/${id}`);
    return response.data;
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

  async rejectEndorsement(id: string, reason: string): Promise<EndorsementItem> {
    const response = await apiClient.post(`/endorsements/${id}/reject`, { reason });
    return response.data;
  },

  async calculateProRata(policyId: string, newAnnualPremium: number) {
    const response = await apiClient.post(`/endorsements/policies/${policyId}/calculate-prorata`, {
      newAnnualPremium,
    });
    return response.data;
  },
};
