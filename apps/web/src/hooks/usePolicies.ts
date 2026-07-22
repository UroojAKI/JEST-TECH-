'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { policiesRepository } from '../repositories/policies.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';

export function usePolicies(params?: PaginationParams) {
  const queryClient = useQueryClient();

  const policiesQuery = useQuery({
    queryKey: ['policies', params],
    queryFn: () => policiesRepository.getPolicies(params),
  });

  const issuePolicyMutation = useMutation({
    mutationFn: policiesRepository.issuePolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy issued successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to issue policy');
    },
  });

  const renewPolicyMutation = useMutation({
    mutationFn: policiesRepository.renewPolicy,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policies'] });
      toast.success('Policy renewed successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to renew policy');
    },
  });

  return {
    policies: policiesQuery.data?.data || [],
    total: policiesQuery.data?.total || 0,
    isLoading: policiesQuery.isLoading,
    isError: policiesQuery.isError,
    issuePolicy: issuePolicyMutation.mutate,
    isIssuing: issuePolicyMutation.isPending,
    renewPolicy: renewPolicyMutation.mutate,
    isRenewing: renewPolicyMutation.isPending,
  };
}
