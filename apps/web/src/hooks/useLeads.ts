'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsRepository } from '../repositories/leads.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';

export function useLeads(params?: PaginationParams) {
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsRepository.getLeads(params),
  });

  const createLeadMutation = useMutation({
    mutationFn: leadsRepository.createLead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead created successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create lead');
    },
  });

  return {
    leads: leadsQuery.data?.data || [],
    total: leadsQuery.data?.total || 0,
    isLoading: leadsQuery.isLoading,
    isError: leadsQuery.isError,
    createLead: createLeadMutation.mutate,
    isCreating: createLeadMutation.isPending,
  };
}
