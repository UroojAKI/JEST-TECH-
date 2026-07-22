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
      category,
      type,
      reason,
    }: {
      policyId: string;
      category: 'FINANCIAL' | 'NON_FINANCIAL';
      type: string;
      reason: string;
    }) => endorsementsRepository.createEndorsement(policyId, category, type, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['endorsements'] });
      toast.success('Endorsement request submitted');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit endorsement');
    },
  });

  return {
    endorsements: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    createEndorsement: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}
