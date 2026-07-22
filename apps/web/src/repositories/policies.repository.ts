import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface PolicyItem {
  id: string;
  policyNumber: string;
  contactName: string;
  productLine: string;
  insurerName: string;
  idvValue: number;
  totalPremium: number;
  status: 'ACTIVE' | 'RENEWAL_DUE' | 'GRACE_PERIOD' | 'EXPIRED' | 'CANCELLED';
  startDate: string;
  expiryDate: string;
  renewalExecutive: string;
  healthScore: number;
  claimsCount: number;
  createdAt: string;
}

export const policiesRepository = {
  async getPolicies(params?: PaginationParams & { status?: string }): Promise<PaginatedResult<PolicyItem>> {
    const response = await apiClient.get('/policies', { params });
    return response.data;
  },

  async getPolicyWorkspace(id: string): Promise<PolicyItem & { health: any; financial: any; campaign: any }> {
    const response = await apiClient.get(`/policies/${id}`);
    return response.data;
  },

  async getPolicyHistory(id: string): Promise<any[]> {
    const response = await apiClient.get(`/policies/${id}/history`);
    return response.data;
  },

  async renewPolicy(id: string, data: any): Promise<PolicyItem> {
    const response = await apiClient.post(`/policies/${id}/renew`, data);
    return response.data;
  },

  async cancelPolicy(id: string, comments: string): Promise<PolicyItem> {
    const response = await apiClient.post(`/policies/${id}/cancel`, { comments });
    return response.data;
  },
};
