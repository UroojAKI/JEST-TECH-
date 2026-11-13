import { apiClient } from '../lib/api-client';

export interface ClickToCallResult {
  id: string;
  providerCallSid: string | null;
  callStatus: string | null;
}

export const telephonyRepository = {
  /** Asks the backend to connect the logged-in agent to this lead via Exotel */
  async callLead(leadId: string): Promise<ClickToCallResult> {
    const response = await apiClient.post(`/telephony/leads/${leadId}/call`);
    return response.data;
  },
};
