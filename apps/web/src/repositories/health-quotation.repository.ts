import { apiClient } from '../lib/api-client';
import { documentsRepository } from './documents.repository';

export const healthQuotationRepository = {
  async getCurrentUser(): Promise<any> {
    return apiClient.get('/users/me');
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
  }): Promise<string> {
    const cleanPhone = proposer.phone.replace(/\D/g, '');

    // Look up by phone only when the user supplied one; missing contact details
    // should not prevent a health proposal from being created.
    if (cleanPhone) {
      try {
        const searchRes = await apiClient.get('/contacts', { params: { search: cleanPhone, limit: 10 } });
        const items = Array.isArray(searchRes.data?.data) ? searchRes.data.data : Array.isArray(searchRes.data) ? searchRes.data : [];
        const match = items.find((c: any) => String(c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (match?.id) return match.id;
      } catch {
        // Continue to creation.
      }
    }

    if (cleanPhone) {
      try {
        const custSearchRes = await apiClient.get('/customers', { params: { search: cleanPhone, limit: 10 } });
        const custItems = Array.isArray(custSearchRes.data?.data) ? custSearchRes.data.data : Array.isArray(custSearchRes.data) ? custSearchRes.data : [];
        const custMatch = custItems.find((c: any) => String(c.mobile || c.phone || '').replace(/\D/g, '') === cleanPhone);
        if (custMatch?.contactId || custMatch?.id) return custMatch.contactId || custMatch.id;
      } catch {
        // Continue to creation.
      }
    }

    // Keep the required case-to-contact link with a minimal, non-sensitive placeholder
    // when the customer opted not to provide contact details.
    const created = await apiClient.post('/contacts', {
      type: 'INDIVIDUAL',
      firstName: proposer.firstName.trim() || 'Quotation',
      lastName: (proposer.lastName || '').trim() || 'Customer',
      ...(cleanPhone ? { phone: cleanPhone } : {}),
      email: proposer.email?.trim() || undefined,
      panNumber: proposer.panNumber?.trim() || undefined,
    });
    return created.data?.id;
  },

  async createCase(payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post('/health/quotation-cases', payload);
    return response.data;
  },

  async getCase(caseId: string): Promise<any> {
    const response = await apiClient.get(`/health/quotation-cases/${caseId}`);
    return response.data;
  },

  async getCasesForLead(leadId: string): Promise<any[]> {
    const response = await apiClient.get(`/health/quotation-cases/lead/${leadId}`);
    return response.data;
  },

  async addQuote(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post(`/health/quotation-cases/${caseId}/quotes`, payload);
    return response.data;
  },

  async selectQuote(caseId: string, quotationId: string): Promise<any> {
    const response = await apiClient.post(`/health/quotation-cases/${caseId}/select`, { quotationId });
    return response.data;
  },

  async getChecklist(caseId: string): Promise<any> {
    const response = await apiClient.get(`/health/quotation-cases/${caseId}/documents`);
    return response.data;
  },

  /** Two steps: store the file with the shared documents API, then attach it to the Health case / quote. */
  async uploadAndAttach(
    caseId: string,
    file: File,
    documentType: string,
    quotationId?: string,
  ): Promise<any> {
    const stored = await documentsRepository.uploadDocument(
      file,
      quotationId ? 'QUOTATION' : 'CONTACT',
      quotationId ?? (await this.getCase(caseId)).contactId,
      { name: file.name, category: `HEALTH_${documentType}` },
    );
    const response = await apiClient.post(`/health/quotation-cases/${caseId}/documents`, {
      documentId: stored.id,
      documentType,
      ...(quotationId ? { quotationId } : {}),
    });
    return response.data;
  },

  async recordPayment(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.post(`/health/quotation-cases/${caseId}/payment`, payload);
    return response.data;
  },

  async getPayment(caseId: string): Promise<any> {
    const response = await apiClient.get(`/health/quotation-cases/${caseId}/payment`);
    return response.data;
  },

  async updateLeftoverDetails(caseId: string, payload: Record<string, any>): Promise<any> {
    const response = await apiClient.patch(`/health/quotation-cases/${caseId}`, payload);
    return response.data;
  },
};

/** Pulls a readable message out of the API error envelope (string or validation array). */
export function healthApiError(err: any, fallback: string): string {
  const data = err?.response?.data;
  const message = data?.error?.message ?? data?.message;
  const readable = (m: string) =>
    String(m)
      .replace(/members\.(\d+)\./g, (_, i) => `Member ${Number(i) + 1} › `)
      .replace(/riders\.(\d+)\./g, (_, i) => `Rider ${Number(i) + 1} › `);
  if (Array.isArray(message)) return message.map(readable).join(' • ');
  return message ? readable(message) : fallback;
}
