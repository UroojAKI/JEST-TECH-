import { apiClient } from '../lib/api-client';
import { documentsRepository } from './documents.repository';

export interface LifeQuotationCaseFilterParams {
  status?: string;
  planCategory?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const lifeQuotationRepository = {
  async getCurrentUser(): Promise<any> {
    return apiClient.get('/users/me');
  },

  async getAgentProfile(): Promise<any> {
    return apiClient.get('/agents/me');
  },

  async getContact(contactId: string): Promise<any> {
    try {
      const response = await apiClient.get(`/contacts/${contactId}`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        try {
          const custRes = await apiClient.get(`/customers/${contactId}`);
          const cust = custRes.data?.data || custRes.data;
          if (cust) {
            return {
              id: cust.contactId || cust.id,
              contactCode: cust.customerCode,
              firstName: cust.firstName,
              lastName: cust.lastName || '',
              phone: cust.mobile,
              email: cust.email,
              panNumber: cust.panNumber,
              aadhaarNumber: cust.aadhaarNumber,
              addressLine1: cust.addressLine1,
              addressLine2: cust.addressLine2,
              city: cust.city,
              state: cust.state,
              pincode: cust.pincode,
            };
          }
        } catch {
          // Re-throw original error
        }
      }
      throw err;
    }
  },

  async resolveOrCreateContact(proposer: {
    firstName: string;
    lastName?: string;
    phone: string;
    email?: string;
    panNumber?: string;
    aadhaarNumber?: string;
    dateOfBirth?: string;
    gender?: string;
  }): Promise<string> {
    const cleanPhone = (proposer.phone || '').replace(/\D/g, '');
    const cleanPan = (proposer.panNumber || '').trim().toUpperCase();
    const cleanAadhaar = (proposer.aadhaarNumber || '').replace(/\D/g, '');

    if (cleanPhone && cleanPhone.length === 10) {
      try {
        const searchRes = await apiClient.get('/contacts', { params: { search: cleanPhone, limit: 10 } });
        const items = Array.isArray(searchRes.data?.data) ? searchRes.data.data : Array.isArray(searchRes.data) ? searchRes.data : [];
        const match = items.find((c: any) => String(c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (match?.id) return match.id;
      } catch {
        // Fallback to customer search
      }
    }

    if (cleanPhone && cleanPhone.length === 10) {
      try {
        const custSearchRes = await apiClient.get('/customers', { params: { search: cleanPhone, limit: 10 } });
        const custItems = Array.isArray(custSearchRes.data?.data) ? custSearchRes.data.data : Array.isArray(custSearchRes.data) ? custSearchRes.data : [];
        const custMatch = custItems.find((c: any) => String(c.mobile || c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (custMatch?.contactId || custMatch?.id) return custMatch.contactId || custMatch.id;
      } catch {
        // Continue to create new contact
      }
    }

    const payload: Record<string, any> = {
      type: 'INDIVIDUAL',
      firstName: proposer.firstName?.trim() || 'Quotation',
      lastName: (proposer.lastName || '').trim() || 'Customer',
    };
    if (cleanPhone && cleanPhone.length === 10 && /^[6-9]/.test(cleanPhone)) {
      payload.phone = cleanPhone;
    }
    if (proposer.email?.trim() && proposer.email.includes('@')) {
      payload.email = proposer.email.trim();
    }
    if (cleanPan && cleanPan.length === 10) {
      payload.panNumber = cleanPan;
    }
    if (cleanAadhaar && cleanAadhaar.length === 12) {
      payload.aadhaarNumber = cleanAadhaar;
    }
    if (proposer.dateOfBirth) {
      payload.dateOfBirth = proposer.dateOfBirth;
    }
    if (proposer.gender) {
      payload.gender = proposer.gender;
    }

    const created = await apiClient.post('/contacts', payload);
    const createdId = created.data?.id || (created.data as any)?.data?.id || (created as any)?.id;
    if (!createdId) {
      throw new Error('Failed to create or resolve customer contact record.');
    }
    return createdId;
  },

  async createCase(payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post('/life/quotation-cases', payload);
    return response.data;
  },

  async getCase(caseId: string): Promise<any> {
    const response = await apiClient.get(`/life/quotation-cases/${caseId}`);
    return response.data;
  },

  async listCases(params?: LifeQuotationCaseFilterParams): Promise<any> {
    const response = await apiClient.get('/life/quotation-cases', { params });
    return response.data;
  },

  async updateCase(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.put(`/life/quotation-cases/${caseId}`, payload);
    return response.data;
  },

  async addQuote(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post(`/life/quotation-cases/${caseId}/quotes`, payload);
    return response.data;
  },

  async selectQuote(caseId: string, quoteId: string): Promise<any> {
    try {
      const response = await apiClient.post(`/life/quotation-cases/${caseId}/quotes/${quoteId}/select`);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.post(`/life/quotation-cases/${caseId}/select`, { quotationId: quoteId });
        return response.data;
      }
      throw err;
    }
  },

  async compareQuotes(caseId: string): Promise<any> {
    const response = await apiClient.get(`/life/quotation-cases/${caseId}/quotes/compare`);
    return response.data;
  },

  async calculateQuote(payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post('/life/quotation-cases/calculate-quote', payload);
    return response.data;
  },

  async getChecklist(caseId: string): Promise<any> {
    const response = await apiClient.get(`/life/quotation-cases/${caseId}/documents/checklist`);
    return response.data;
  },

  async uploadFileToDocumentStore(file: File, meta?: { entityType?: string; entityId?: string }): Promise<any> {
    return documentsRepository.uploadDocument(
      file,
      meta?.entityType || 'LIFE_QUOTATION_CASE',
      meta?.entityId || 'life-temp',
    );
  },

  async attachDocument(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post(`/life/quotation-cases/${caseId}/documents`, payload);
    return response.data;
  },

  async verifyDocument(documentId: string, payload: { verificationStatus: string; rejectionReason?: string }): Promise<any> {
    const response = await apiClient.patch(`/life/quotation-cases/documents/${documentId}/verify`, payload);
    return response.data;
  },

  async recordPayment(caseId: string, quoteId: string, payload: Record<string, any>): Promise<any> {
    try {
      const response = await apiClient.post(`/life/quotation-cases/${caseId}/quotes/${quoteId}/payment`, payload);
      return response.data;
    } catch (err: any) {
      if (err?.response?.status === 404) {
        const response = await apiClient.post(`/life/quotation-cases/${caseId}/payment`, { quotationId: quoteId, ...payload });
        return response.data;
      }
      throw err;
    }
  },

  async issuePolicy(payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post('/policies/issue', payload);
    return response.data;
  },
};

