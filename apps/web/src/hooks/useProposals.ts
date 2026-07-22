'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { proposalsRepository } from '../repositories/proposals.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';

export function useProposals(params?: PaginationParams) {
  const query = useQuery({
    queryKey: ['proposals', params],
    queryFn: () => proposalsRepository.getProposals(params),
  });

  return {
    proposals: query.data?.data || [],
    total: query.data?.total || 0,
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
    mutationFn: () => proposalsRepository.issuePolicy(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      toast.success('Policy issued successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to issue policy');
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
