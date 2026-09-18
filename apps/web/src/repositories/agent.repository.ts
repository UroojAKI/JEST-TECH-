import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface AgentProfile {
  id: string;
  agentCode: string;
  agencyName?: string | null;
  licenseNumber?: string | null;
  commissionTier: string;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName?: string | null;
    phone?: string | null;
  };
  _count?: {
    leads: number;
    quotations: number;
  };
  createdAt: string;
}

export interface AgentStats {
  agentId: string;
  agentCode: string;
  pipeline: {
    totalLeads: number;
    inProgressLeads: number;
    convertedLeads: number;
    lostLeads: number;
    conversionRate: string;
  };
  quotations: {
    totalQuotes: number;
    acceptedQuotes: number;
    totalPremium: number;
  };
}

export const agentRepository = {
  async getMe(): Promise<AgentProfile> {
    const response = await apiClient.get('/agents/me');
    return response.data;
  },

  async getAgents(params?: PaginationParams & { isActive?: boolean }): Promise<PaginatedResult<AgentProfile>> {
    const response = await apiClient.get('/agents', { params });
    return response.data;
  },

  async getAgentById(id: string): Promise<AgentProfile> {
    const response = await apiClient.get(`/agents/${id}`);
    return response.data;
  },

  async getAgentStats(id: string): Promise<AgentStats> {
    const response = await apiClient.get(`/agents/${id}/stats`);
    return response.data;
  },
};
