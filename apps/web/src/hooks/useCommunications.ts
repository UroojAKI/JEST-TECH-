'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationsRepository } from '../repositories/communications.repository';
import { toast } from 'sonner';

export function useCommunications(params?: { channel?: string; customerId?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['communications', params],
    queryFn: () => communicationsRepository.getCommunications(params),
  });

  const sendMutation = useMutation({
    mutationFn: (data: any) => communicationsRepository.sendCommunication(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['communications'] });
      toast.success('Communication message dispatched successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to dispatch message');
    },
  });

  return {
    communications: query.data || [],
    isLoading: query.isLoading,
    sendMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
  };
}

export function useNotificationTemplates() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notification-templates'],
    queryFn: () => communicationsRepository.getNotificationTemplates(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, bodyTemplate }: { id: string; bodyTemplate: string }) =>
      communicationsRepository.updateTemplate(id, bodyTemplate),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-templates'] });
      toast.success('Notification template updated!');
    },
  });

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    updateTemplate: updateMutation.mutate,
  };
}

export function useDeliveryLogs() {
  return useQuery({
    queryKey: ['delivery-logs'],
    queryFn: () => communicationsRepository.getDeliveryLogs(),
  });
}

export function useEventStream(category?: string) {
  return useQuery({
    queryKey: ['event-stream', category],
    queryFn: () => communicationsRepository.getEventStream(category),
    refetchInterval: 10000,
  });
}
