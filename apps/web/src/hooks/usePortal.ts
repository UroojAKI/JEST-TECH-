'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { portalRepository } from '../repositories/portal.repository';
import { toast } from 'sonner';

export function useAgentDashboard() {
  return useQuery({
    queryKey: ['agent-dashboard'],
    queryFn: () => portalRepository.getDashboardMetrics(),
  });
}

export function useAgentCustomers(search?: string) {
  return useQuery({
    queryKey: ['agent-customers', search],
    queryFn: () => portalRepository.getCustomers(search),
  });
}

export function useAgentLeads(status?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['agent-leads', status],
    queryFn: () => portalRepository.getLeads(status),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => portalRepository.createLead(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-leads'] });
      toast.success('Agent Lead created successfully!');
    },
  });

  return {
    leads: query.data || [],
    isLoading: query.isLoading,
    createLead: createMutation.mutate,
    isCreating: createMutation.isPending,
  };
}

export function useAgentPolicies(status?: string) {
  return useQuery({
    queryKey: ['agent-policies', status],
    queryFn: () => portalRepository.getPolicies(status),
  });
}

export function useAgentRenewals(bucket?: string) {
  return useQuery({
    queryKey: ['agent-renewals', bucket],
    queryFn: () => portalRepository.getRenewals(bucket),
  });
}

export function useAgentCommissions() {
  return useQuery({
    queryKey: ['agent-commissions'],
    queryFn: () => portalRepository.getCommissions(),
  });
}

export function useBranchTeamMetrics() {
  return useQuery({
    queryKey: ['branch-team-metrics'],
    queryFn: () => portalRepository.getBranchTeamMetrics(),
  });
}
