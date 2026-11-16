import { apiClient } from '../lib/api-client';

export interface ClickToCallResult {
  id: string;
  providerCallSid: string | null;
  callStatus: string | null;
}

export interface CallHistoryItem {
  id: string;
  createdAt: string;
  callType: string;
  callOutcome: string;
  callStatus: string | null;
  provider: string | null;
  durationSeconds: number;
  startedAt: string | null;
  endedAt: string | null;
  toNumber: string | null;
  fromNumber: string | null;
  notes: string | null;
  agentName: string;
  ivrOption: string | null;
  hasRecording: boolean;
}

export interface IncomingCall {
  id: string;
  createdAt: string;
  fromNumber: string | null;
  ivrOption: string | null;
  lead: {
    id: string;
    leadCode: string;
    title: string;
    customerName: string;
  } | null;
}

export const telephonyRepository = {
  /** Incoming calls currently ringing on the logged-in agent's phone */
  async getActiveIncomingCalls(): Promise<IncomingCall[]> {
    const response = await apiClient.get('/telephony/incoming/active');
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Asks the backend to connect the logged-in agent to this lead via Exotel */
  async callLead(leadId: string): Promise<ClickToCallResult> {
    const response = await apiClient.post(`/telephony/leads/${leadId}/call`);
    return response.data;
  },

  /** All calls for a lead, newest first */
  async listLeadCalls(leadId: string): Promise<CallHistoryItem[]> {
    const response = await apiClient.get(`/telephony/leads/${leadId}/calls`);
    return Array.isArray(response.data) ? response.data : [];
  },

  /** Downloads a recording as audio the browser can play */
  async getRecordingBlob(callId: string): Promise<Blob> {
    const response = await apiClient.get(`/telephony/calls/${callId}/recording`, {
      responseType: 'blob',
    });
    return response.data;
  },
};
