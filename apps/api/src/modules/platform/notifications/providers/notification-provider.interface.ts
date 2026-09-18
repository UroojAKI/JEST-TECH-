export interface SendNotificationPayload {
  to: string;
  recipientName?: string;
  title: string;
  message: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
}

export interface NotificationProviderResult {
  success: boolean;
  status: 'SENT' | 'FAILED' | 'NOT_CONFIGURED';
  providerMessageId?: string;
  failureReason?: string;
}

export interface NotificationChannelProvider {
  channelName: string;
  send(payload: SendNotificationPayload): Promise<NotificationProviderResult>;
}
