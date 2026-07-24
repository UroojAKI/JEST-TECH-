import { apiClient } from '../lib/api-client';

export interface CommunicationItem {
  id: string;
  customerName: string;
  customerId: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'PHONE_CALL' | 'INTERNAL_NOTE';
  direction: 'INBOUND' | 'OUTBOUND';
  category: 'SYSTEM_GENERATED' | 'MANUAL' | 'CUSTOMER_REPLY' | 'INTERNAL_NOTE';
  sender: string;
  recipient: string;
  messageContent: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  relatedEntity: { type: 'LEAD' | 'POLICY' | 'CLAIM' | 'RENEWAL'; number: string };
  timestamp: string;
}

export interface NotificationTemplate {
  id: string;
  code: string;
  name: string;
  channel: 'WHATSAPP' | 'SMS' | 'EMAIL';
  category: 'POLICIES' | 'RENEWALS' | 'CLAIMS' | 'FINANCE' | 'SYSTEM';
  subject?: string;
  bodyTemplate: string;
  sampleData: Record<string, string>;
  isSystem: boolean;
}

export interface DeliveryLogItem {
  id: string;
  recipient: string;
  channel: string;
  status: 'DELIVERED' | 'READ' | 'FAILED' | 'RETRYING';
  retryCount: number;
  provider: string;
  latencyMs: number;
  failureReason?: string;
  timestamp: string;
}

export interface EventStreamItem {
  id: string;
  eventType: string;
  category: 'WORKFLOW' | 'NOTIFICATION' | 'FINANCE' | 'CLAIMS' | 'RENEWALS' | 'REPORTS' | 'AUTH' | 'ADMIN';
  sourceModule: string;
  summary: string;
  userEmail: string;
  timestamp: string;
}

export const communicationsRepository = {
  async getCommunications(params?: { channel?: string; customerId?: string }): Promise<CommunicationItem[]> {
    const response = await apiClient.get('/communications', { params });
    return response.data;
  },

  async sendCommunication(data: Partial<CommunicationItem>): Promise<CommunicationItem> {
    const response = await apiClient.post('/communications', data);
    return response.data;
  },

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const response = await apiClient.get('/notifications/templates');
    return response.data;
  },

  async updateTemplate(id: string, bodyTemplate: string): Promise<NotificationTemplate> {
    const response = await apiClient.put(`/notifications/templates/${id}`, { bodyTemplate });
    return response.data;
  },

  async getDeliveryLogs(): Promise<DeliveryLogItem[]> {
    const response = await apiClient.get('/notifications/delivery-logs');
    return response.data;
  },

  async getEventStream(category?: string): Promise<EventStreamItem[]> {
    const response = await apiClient.get('/notifications/events', { params: { category } });
    return response.data;
  },
};
