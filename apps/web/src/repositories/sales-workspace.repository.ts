import { apiClient } from '../lib/api-client';

export const salesWorkspaceRepository = {
  async getDashboard(): Promise<any> {
    const response = await apiClient.get('/workspace/sales/dashboard');
    return response.data;
  },

  async getKpis(): Promise<any> {
    const response = await apiClient.get('/workspace/sales/kpis');
    return response.data;
  },

  async getPipeline(): Promise<any> {
    const response = await apiClient.get('/workspace/sales/pipeline');
    return response.data;
  },

  async moveStage(leadId: string, targetStage: string, overrideReason?: string, remarks?: string): Promise<any> {
    const response = await apiClient.post(`/workspace/sales/lead/${leadId}/move-stage`, {
      targetStage,
      overrideReason,
      remarks,
    });
    return response.data;
  },

  async getStageHistory(leadId: string): Promise<any[]> {
    const response = await apiClient.get(`/workspace/sales/lead/${leadId}/stage-history`);
    return response.data;
  },

  async createReferral(leadId: string, data: { referralName: string; phone: string; email?: string; relationship?: string; interestedProduct?: string }): Promise<any> {
    const response = await apiClient.post(`/workspace/sales/lead/${leadId}/referral`, data);
    return response.data;
  },

  async markNoReferral(leadId: string, reason: string): Promise<any> {
    const response = await apiClient.post(`/workspace/sales/lead/${leadId}/no-referral`, { reason });
    return response.data;
  },

  async logCall(leadId: string, data: { callOutcome: string; notes?: string; scheduledFollowup?: string }): Promise<any> {
    const response = await apiClient.post(`/workspace/sales/lead/${leadId}/calls`, data);
    return response.data;
  },

  async crmUpdate(leadId: string): Promise<any> {
    const response = await apiClient.post(`/workspace/sales/lead/${leadId}/crm-update`);
    return response.data;
  },
};
