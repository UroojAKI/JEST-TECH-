import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface ProposalItem {
  id: string;
  proposalNumber: string;
  quotationId: string;
  contactName: string;
  productLine: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'POLICY_ISSUED';
  riskScore: number;
  checklistProgress: number; // percentage
  documentsCount: number;
  totalPremium: number;
  createdAt: string;
}

export const proposalsRepository = {
  async getProposals(params?: PaginationParams): Promise<PaginatedResult<ProposalItem>> {
    const response = await apiClient.get('/proposals', { params });
    return response.data;
  },

  async getProposalDetails(id: string): Promise<ProposalItem & { checklist: any[]; notes: any[] }> {
    const response = await apiClient.get(`/proposals/${id}`);
    return response.data;
  },

  async createProposal(quotationId: string): Promise<ProposalItem> {
    const response = await apiClient.post('/proposals', { quotationId });
    return response.data;
  },

  async attachDocument(id: string, checklistItemId: string, documentId: string): Promise<any> {
    const response = await apiClient.post(`/proposals/${id}/attach`, { checklistItemId, documentId });
    return response.data;
  },

  async submitProposal(id: string): Promise<ProposalItem> {
    const response = await apiClient.post(`/proposals/${id}/submit`);
    return response.data;
  },

  async reviewProposal(id: string, approve: boolean, remarks: string): Promise<ProposalItem> {
    const response = await apiClient.post(`/proposals/${id}/review`, { approve, remarks });
    return response.data;
  },

  async issuePolicy(proposalId: string): Promise<any> {
    const response = await apiClient.post('/policies', { proposalId });
    return response.data;
  },
};
