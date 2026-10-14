'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { endorsementsRepository } from '../repositories/endorsements.repository';
import { toast } from 'sonner';

export function useEndorsements() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['endorsements'],
    queryFn: () => endorsementsRepository.getEndorsements(),
  });

  const createMutation = useMutation({
    mutationFn: ({
      policyId,
      type,
      reason,
      requestedChanges,
    }: {
      policyId: string;
      type: string;
      reason: string;
      requestedChanges?: Record<string, any>;
    }) => endorsementsRepository.createEndorsement(policyId, type, reason, requestedChanges),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
      queryClient.invalidateQueries({ queryKey: ['policy-detail'] });
      toast.success('Endorsement request submitted successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit endorsement request');
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) =>
      endorsementsRepository.approveEndorsement(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
      queryClient.invalidateQueries({ queryKey: ['policy-detail'] });
      toast.success('Endorsement approved and applied to policy');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve endorsement');
    },
  });

  return {
    endorsements: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    createEndorsement: createMutation.mutate,
    isCreating: createMutation.isPending,
    approveEndorsement: approveMutation.mutate,
    isApproving: approveMutation.isPending,
  };
}
