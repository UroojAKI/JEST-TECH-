'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsRepository } from '../repositories/proposals.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';
import { showApiErrorToast } from '../lib/api-client';

export function useProposals(params?: PaginationParams) {
  const query = useQuery({
    queryKey: ['proposals', params],
    queryFn: () => proposalsRepository.getProposals(params),
  });

  const list = Array.isArray(query.data) ? query.data : (query.data?.data || []);

  return {
    proposals: list,
    total: Array.isArray(query.data) ? query.data.length : (query.data?.total || list.length),
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useProposalWorkspace(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['proposal-workspace', id],
    queryFn: () => proposalsRepository.getProposalDetails(id),
    enabled: !!id,
  });

  const reviewMutation = useMutation({
    mutationFn: ({ approve, remarks }: { approve: boolean; remarks: string }) =>
      proposalsRepository.reviewProposal(id, approve, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-workspace', id] });
      toast.success('Underwriting review submitted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit review');
    },
  });

  const issuePolicyMutation = useMutation({
    mutationFn: (payload?: any) =>
      proposalsRepository.issuePolicy(id, payload?.quotationId, payload?.isMotor, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-workspace', id] });
      toast.success('Policy issued successfully!');
    },
    onError: (err: any) => {
      showApiErrorToast(
        err,
        'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be issued.'
      );
    },
  });

  return {
    proposal: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    reviewProposal: reviewMutation.mutate,
    issuePolicy: issuePolicyMutation.mutate,
    isReviewing: reviewMutation.isPending,
    isIssuing: issuePolicyMutation.isPending,
  };
}
