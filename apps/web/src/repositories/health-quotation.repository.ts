import { apiClient } from '../lib/api-client';
import { documentsRepository } from './documents.repository';

export const healthQuotationRepository = {
  async getContact(contactId: string): Promise<any> {
    const response = await apiClient.get(`/contacts/${contactId}`);
    return response.data;
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
