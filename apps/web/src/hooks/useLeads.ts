'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadsRepository } from '../repositories/leads.repository';
import { PaginationParams } from '../types';
import { LeadFilterParams, LostReason } from '../types/leads';
import { toast } from 'sonner';

export function useLeads(params?: PaginationParams & LeadFilterParams) {
  const queryClient = useQueryClient();

  const leadsQuery = useQuery({
    queryKey: ['leads', params],
    queryFn: () => leadsRepository.getLeads(params),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadsRepository.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead stage updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update lead status');
    },
  });

  const markLostMutation = useMutation({
    mutationFn: ({
      id,
      reason,
      competitor,
      priceDiff,
      remarks,
    }: {
      id: string;
      reason: LostReason;
      competitor?: string;
      priceDiff?: number;
      remarks?: string;
    }) => leadsRepository.markLost(id, reason, competitor, priceDiff, remarks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      toast.success('Lead marked as Lost');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to mark lead as lost');
    },
  });

  return {
    leads: leadsQuery.data?.data || [],
    total: leadsQuery.data?.total || 0,
    isLoading: leadsQuery.isLoading,
    isError: leadsQuery.isError,
    refetch: leadsQuery.refetch,
    updateStatus: updateStatusMutation.mutate,
    markLost: markLostMutation.mutate,
    isUpdating: updateStatusMutation.isPending || markLostMutation.isPending,
  };
}

export function useLeadWorkspace(id: string) {
  const query = useQuery({
    queryKey: ['lead-workspace', id],
    queryFn: () => leadsRepository.getLeadWorkspace(id),
    enabled: !!id,
  });

  return {
    lead: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
