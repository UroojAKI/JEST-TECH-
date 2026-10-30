import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface PolicyDocumentItem {
  id: string;
  documentId?: string | null;
  documentType: string;
  fileKey?: string;
  fileName: string;
  fileSize?: number;
  mimeType?: string | null;
  createdAt: string;
  source?: 'POLICY' | 'QUOTATION';
  verificationStatus?: string | null;
}

export interface PolicyVehicle {
  id?: string;
  registrationNumber?: string | null;
  makeModel?: string | null;
  manufactureYearMonth?: string | null;
  engineNumber?: string | null;
  chassisNumber?: string | null;
  fuelType?: string | null;
  rtoLocation?: string | null;
  category?: string | null;
}

export interface PolicyItem {
  id: string;
  policyNumber: string;
  contactName?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  customerName?: string | null;
  customerId?: string | null;
  productLine?: string;
  policyType?: string | null;
  insurerName?: string;
  quotationId?: string | null;
  quotationCode?: string | null;
  idvValue?: number;
  totalPremium?: number;
  netPremium?: number;
  odPremium?: number;
  tpPremium?: number;
  addonPremium?: number;
  discountAmount?: number;
  ncbPercentage?: number;
  gstAmount?: number;
  netPayable?: number;
  premiumAmount?: number;
  status: 'ACTIVE' | 'RENEWAL_DUE' | 'GRACE_PERIOD' | 'EXPIRED' | 'CANCELLED' | string;
  startDate?: string;
  endDate?: string;
  expiryDate?: string;
  odStartDate?: string | null;
  odExpiryDate?: string | null;
  tpStartDate?: string | null;
  tpExpiryDate?: string | null;
  paymentStatus?: string | null;
  paidAmount?: number;
  receiptAmount?: number;
  outstandingBalance?: number;
  renewalExecutive?: string | null;
  healthScore?: number;
  claimsCount?: number;
  createdAt: string;
  vehicle?: PolicyVehicle | null;
  claims?: any[];
  endorsements?: any[];
  documents?: PolicyDocumentItem[];
  payments?: any[];
  renewals?: any[];
  histories?: any[];
}

export const policiesRepository = {
  async getPolicies(params?: Partial<PaginationParams> & { status?: string }): Promise<PaginatedResult<PolicyItem>> {
    const response = await apiClient.get('/policies', { params });
    return response.data;
  },

  async getPolicyAuditReport(params?: Partial<PaginationParams> & { status?: string; search?: string }): Promise<PaginatedResult<PolicyItem>> {
    try {
      const response = await apiClient.get('/policies/audit-report', { params });
      return response.data;
    } catch {
      const response = await apiClient.get('/policies', { params });
      return response.data;
    }
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

  async issueFromQueue(quotationId: string, data?: any): Promise<any> {
    const response = await apiClient.post(`/back-office/issue/${quotationId}`, data || {});
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

  async getRenewalQuotePrefill(policyId: string): Promise<any> {
    const response = await apiClient.get(`/renewals/policies/${policyId}/quote-prefill`);
    return response.data;
  },
};
