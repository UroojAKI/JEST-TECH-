import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface QuotationItem {
  id: string;
  quotationNumber: string;
  version: number;
  contactId?: string;
  contactName: string;
  productLine: string;
  insurerName: string;
  idvValue: number;
  ownDamagePremium: number;
  thirdPartyPremium: number;
  addonsPremium: number;
  ncbDiscount: number;
  gstAmount: number;
  totalPremium: number;
  status: 'DRAFT' | 'SHARED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  expiryDate: string;
  createdAt: string;
}

export const quotationsRepository = {
  async getQuotations(params?: Partial<PaginationParams> & { status?: string }): Promise<PaginatedResult<QuotationItem>> {
    const response = await apiClient.get('/quotations', { params });
    return response.data;
  },

  async getQuotationById(id: string): Promise<QuotationItem> {
    const response = await apiClient.get(`/quotations/${id}`);
    return response.data;
  },

  async getQuotationHistory(id: string): Promise<any[]> {
    const response = await apiClient.get(`/quotations/${id}/history`);
    return response.data;
  },

  async compareQuotations(ids: string[]): Promise<any> {
    const response = await apiClient.post('/quotations/compare', { ids });
    return response.data;
  },

  async createQuotation(data: any): Promise<QuotationItem> {
    const response = await apiClient.post('/quotations', data);
    return response.data;
  },

  async approveQuotation(id: string, comments: string): Promise<QuotationItem> {
    const response = await apiClient.post(`/quotations/${id}/approve`, { comments });
    return response.data;
  },

  async rejectQuotation(id: string, comments: string): Promise<QuotationItem> {
    const response = await apiClient.post(`/quotations/${id}/reject`, { comments });
    return response.data;
  },

  async convertQuotation(id: string): Promise<any> {
    const response = await apiClient.post(`/quotations/${id}/convert`);
    return response.data;
  },

  async acceptQuotation(id: string, comments?: string): Promise<QuotationItem> {
    const response = await apiClient.post(`/quotations/${id}/accept`, { comments });
    return response.data;
  },

  async createQuotationVersion(id: string, data: any): Promise<QuotationItem> {
    const response = await apiClient.post(`/quotations/${id}/versions`, data);
    return response.data;
  },

  async getQuotationVersions(id: string): Promise<any[]> {
    const response = await apiClient.get(`/quotations/${id}/versions`);
    return response.data;
  },

  async getQuotationCompletion(id: string): Promise<QuotationCompletionResult> {
    const response = await apiClient.get(`/quotations/${id}/completion`);
    return response.data;
  },
  async updateQuotationDetails(id: string, details: Record<string, any>): Promise<QuotationCompletionResult> {
    const response = await apiClient.patch(`/quotations/${id}/details`, details);
    return response.data;
  },
};

export interface MissingFieldItem {
  field: string;
  label: string;
  requiredFor: 'QUOTATION_CREATION' | 'APPROVAL' | 'POLICY_ISSUANCE';
  condition?: string;
  value?: any;
}

export interface CompletionSection {
  section: string;
  label: string;
  complete: boolean;
  applicableCount: number;
  completedCount: number;
  missing: MissingFieldItem[];
}

export interface QuotationCompletionResult {
  quotationId: string;
  quotationCode: string;
  status: 'COMPLETE' | 'INCOMPLETE';
  completionPercentage: number;
  canApprove: boolean;
  canIssuePolicy: boolean;
  workflowState: string | null;
  sections: CompletionSection[];
}

