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
  async getPolicies(params?: Partial<PaginationParams> & { status?: string }): Promise<PaginatedResult<PolicyItem>> {
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

  async createPolicy(data: any): Promise<PolicyItem> {
    const quotationId = data?.quotationId || data?.quoteId;
    if (quotationId) {
      const response = await apiClient.post(`/back-office/issue/${quotationId}`, data);
      return response.data;
    }
    const response = await apiClient.post('/policies', data);
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

  async issuePolicy(data: any): Promise<PolicyItem> {
    const quotationId = data?.quotationId || data?.quoteId;
    if (quotationId) {
      const response = await apiClient.post(`/back-office/issue/${quotationId}`, data);
      return response.data;
    }
    const response = await apiClient.post('/policies/issue', data);
    return response.data;
  },

  async getBackOfficeQueue(params?: { search?: string; status?: string }): Promise<any> {
    const response = await apiClient.get('/back-office/queue', { params });
    return response.data;
  },

  async issueFromQueue(quotationId: string): Promise<any> {
    const response = await apiClient.post(`/back-office/issue/${quotationId}`);
    return response.data;
  },

  async getRenewalQueue(params?: { search?: string; urgency?: string; page?: number; limit?: number }): Promise<any> {
    const response = await apiClient.get('/policies/renewals/queue', { params });
    return response.data;
  },

  async sendRenewalReminder(policyId: string): Promise<any> {
    const response = await apiClient.post(`/policies/renewals/${policyId}/remind`);
    return response.data;
  },

  async escalateRenewal(policyId: string): Promise<any> {
    const response = await apiClient.post(`/policies/renewals/${policyId}/escalate`);
    return response.data;
  },

  async getRenewalKpis(): Promise<any> {
    const response = await apiClient.get('/policies/renewals/kpis');
    return response.data;
  },
};
