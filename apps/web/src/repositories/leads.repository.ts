import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';
import { LeadItem, LeadFilterParams, LostReason } from '../types/leads';

export const leadsRepository = {
  async getLeads(params?: PaginationParams & LeadFilterParams): Promise<PaginatedResult<LeadItem>> {
    const response = await apiClient.get('/leads', { params });
    return response.data;
  },

  async getLeadById(id: string): Promise<LeadItem> {
    const response = await apiClient.get(`/leads/${id}`);
    return response.data;
  },

  async getLeadWorkspace(id: string): Promise<any> {
    const response = await apiClient.get(`/leads/${id}`);
    return response.data;
  },

  async createLead(data: Partial<LeadItem>): Promise<LeadItem> {
    const response = await apiClient.post('/leads', data);
    return response.data;
  },

  async updateLeadStatus(id: string, status: string): Promise<LeadItem> {
    const response = await apiClient.patch(`/leads/${id}`, { status });
    return response.data;
  },

  async assignLead(id: string, assignedToId: string): Promise<LeadItem> {
    const response = await apiClient.post(`/leads/${id}/assign`, { assignedToId });
    return response.data;
  },

  async addNote(id: string, content: string, isPinned = false, isPrivate = false): Promise<any> {
    const response = await apiClient.post(`/leads/${id}/notes`, { content, isPinned, isPrivate });
    return response.data;
  },

  async logActivity(id: string, type: string, description: string): Promise<any> {
    const response = await apiClient.post(`/leads/${id}/activities`, { type, description });
    return response.data;
  },

  async markLost(id: string, reason: LostReason, competitor?: string, priceDiff?: number, remarks?: string): Promise<LeadItem> {
    const response = await apiClient.patch(`/leads/${id}`, {
      status: 'LOST',
      lostReason: reason,
      competitor,
      priceDiff,
      remarks,
    });
    return response.data;
  },

  async convertLead(id: string): Promise<any> {
    const response = await apiClient.post(`/leads/${id}/convert`);
    return response.data;
  },
};
