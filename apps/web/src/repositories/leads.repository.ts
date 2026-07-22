import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: string;
  source: string;
  productInterest: string;
  assignedToId?: string;
  createdAt: string;
}

export const leadsRepository = {
  async getLeads(params?: PaginationParams): Promise<PaginatedResult<Lead>> {
    const response = await apiClient.get('/leads', { params });
    return response.data;
  },

  async getLeadById(id: string): Promise<Lead> {
    const response = await apiClient.get(`/leads/${id}`);
    return response.data;
  },

  async createLead(data: Partial<Lead>): Promise<Lead> {
    const response = await apiClient.post('/leads', data);
    return response.data;
  },

  async updateLead(id: string, data: Partial<Lead>): Promise<Lead> {
    const response = await apiClient.patch(`/leads/${id}`, data);
    return response.data;
  },
};
