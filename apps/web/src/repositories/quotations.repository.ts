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
  async getQuotations(params?: PaginationParams & { status?: string }): Promise<PaginatedResult<QuotationItem>> {
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
};
