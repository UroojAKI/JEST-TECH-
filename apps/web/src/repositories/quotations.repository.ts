import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

const CUSTOMER_PORTAL_ROLES = new Set(['CUSTOMER', 'CLIENT']);

/**
 * Returns true when at least one assigned role represents internal agency staff
 * (Agent, Back Office, or Admin) permitted to hand off quotations to Back Office.
 */
export function canUserSubmitToBackOffice(
  roles: Array<string | null | undefined>,
): boolean {
  const normalized = roles
    .filter((r): r is string => Boolean(r))
    .map((r) => String(r).toUpperCase());
  if (normalized.length === 0) return true;
  return normalized.some((r) => !CUSTOMER_PORTAL_ROLES.has(r));
}

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

  async submitToBackOffice(id: string): Promise<any> {
    const response = await apiClient.post(`/quotations/${id}/submit-to-back-office`);
    return response.data;
  },

  /**
   * Binds the winning quotation to its Motor Quotation Case (when linked to a case)
   * and submits it into the Back-Office Policy Issuance queue.
   */
  async selectAndSubmitMotorQuotation(quotationId: string, caseId?: string | null): Promise<any> {
    if (caseId) {
      await apiClient.post(`/motor/quotation-cases/${caseId}/select`, { quotationId });
    }
    return this.submitToBackOffice(quotationId);
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

  async acceptQuotation(
    id: string,
    evidence: {
      evidenceMethod: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PHYSICAL_SIGNATURE' | 'VERBAL_CALL_RECORDING' | 'PORTAL_CLICK';
      evidenceReference?: string;
      comments?: string;
      selectedGstRate?: number;
    },
  ): Promise<QuotationItem> {
    const response = await apiClient.post(`/quotations/${id}/accept`, evidence);
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

