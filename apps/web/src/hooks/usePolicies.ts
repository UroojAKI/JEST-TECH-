'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesRepository } from '../repositories/policies.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';

export function usePolicies(params?: Partial<PaginationParams> & { status?: string }) {
  const query = useQuery({
    queryKey: ['policies', params],
    queryFn: () => policiesRepository.getPolicies(params),
  });

  const list = Array.isArray(query.data) ? query.data : (query.data?.data || []);

  return {
    policies: list,
    total: Array.isArray(query.data) ? query.data.length : (query.data?.total || list.length),
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function usePolicyWorkspace(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['policy-workspace', id],
    queryFn: () => policiesRepository.getPolicyWorkspace(id),
    enabled: !!id,
  });

  const renewMutation = useMutation({
    mutationFn: (data: any) => policiesRepository.renewPolicy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      queryClient.invalidateQueries({ queryKey: ['policy-workspace', id] });
      toast.success('Policy renewed successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to renew policy');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (comments: string) => policiesRepository.cancelPolicy(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy cancelled');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to cancel policy');
    },
  });

  return {
    policy: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    renewPolicy: renewMutation.mutate,
    cancelPolicy: cancelMutation.mutate,
    isRenewing: renewMutation.isPending,
    isCancelling: cancelMutation.isPending,
  };
}
