import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface MotorQuotationItem {
  id: string;
  quotationNumber: string;
  leadId: string;
  vehicleId: string;
  customerId?: string | null;
  agentId?: string | null;
  agentCodeSnapshot?: string | null;
  insurerName: string;
  planName?: string | null;
  policyType: string;
  status: 'DRAFT' | 'SHARED' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  idv?: number | null;
  odPremium?: number | null;
  tpPremium?: number | null;
  addonPremium?: number | null;
  ncbDiscount?: number | null;
  otherDiscounts?: number | null;
  netPremium?: number | null;
  gstAmount?: number | null;
  finalPremium: number;
  breakup?: Record<string, any> | null;
  addonsSelected?: any;
  vehicle?: {
    id: string;
    registrationNumber: string;
    category: string;
    make?: string | null;
    model?: string | null;
  };
  lead?: {
    id: string;
    leadCode: string;
    title: string;
    status: string;
  };
  customer?: {
    id: string;
    customerCode: string;
    firstName: string;
    lastName?: string | null;
    mobile: string;
  };
  createdAt: string;
}

export interface ComparisonResult {
  vehicleId: string;
  count: number;
  bestPrice: number | null;
  highestPrice: number | null;
  averagePrice: number | null;
  comparison: Array<{
    id: string;
    quotationNumber: string;
    insurerName: string;
    planName?: string | null;
    status: string;
    idv?: number | null;
    odPremium?: number | null;
    tpPremium?: number | null;
    addonPremium?: number | null;
    ncbDiscount?: number | null;
    netPremium?: number | null;
    gstAmount?: number | null;
    finalPremium: number;
    isLowest: boolean;
    addonsSelected?: any;
  }>;
}

export const motorQuotationRepository = {
  async getQuotations(params?: PaginationParams & { vehicleId?: string; leadId?: string; status?: string; insurerName?: string }): Promise<PaginatedResult<MotorQuotationItem>> {
    const response = await apiClient.get('/motor-quotations', { params });
    return response.data;
  },

  async getQuotationById(id: string): Promise<MotorQuotationItem & { categoryConfig?: any }> {
    const response = await apiClient.get(`/motor-quotations/${id}`);
    return response.data;
  },

  async createQuotation(data: any): Promise<MotorQuotationItem> {
    const response = await apiClient.post('/motor-quotations', data);
    return response.data;
  },

  async compareQuotes(vehicleId: string): Promise<ComparisonResult> {
    const response = await apiClient.get('/motor-quotations/compare', { params: { vehicleId } });
    return response.data;
  },

  async acceptQuotation(id: string): Promise<{ success: boolean; message: string; quotationId: string; nextStep: string }> {
    const response = await apiClient.post(`/motor-quotations/${id}/accept`);
    return response.data;
  },
};
