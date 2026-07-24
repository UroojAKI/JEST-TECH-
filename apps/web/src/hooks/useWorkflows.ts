'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsRepository } from '../repositories/workflows.repository';
import { toast } from 'sonner';

export function useWorkflows() {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsRepository.getWorkflows(),
  });
}

export function useWorkflowInstances() {
  return useQuery({
    queryKey: ['workflow-instances'],
    queryFn: () => workflowsRepository.getWorkflowInstances(),
  });
}

export function useApprovals(params?: { status?: string; module?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['approvals', params],
    queryFn: () => workflowsRepository.getApprovals(params),
  });

  const actionMutation = useMutation({
    mutationFn: ({ id, action, comments }: { id: string; action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ESCALATE'; comments?: string }) =>
      workflowsRepository.executeApprovalAction(id, action, comments),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      queryClient.invalidateQueries({ queryKey: ['workflow-instances'] });
      toast.success(`Approval action ${variables.action} executed!`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to execute approval action');
    },
  });

  const bulkMutation = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: 'APPROVE' | 'REJECT' | 'ESCALATE' }) =>
      workflowsRepository.bulkApprovalActions(ids, action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] });
      toast.success(`Bulk ${variables.action} executed on ${variables.ids.length} approvals!`);
    },
  });

  return {
    approvals: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    executeAction: actionMutation.mutate,
    isExecuting: actionMutation.isPending,
    executeBulkAction: bulkMutation.mutate,
    isBulkExecuting: bulkMutation.isPending,
  };
}

export function useSlaMetrics() {
  return useQuery({
    queryKey: ['workflow-sla-metrics'],
    queryFn: () => workflowsRepository.getSlaMetrics(),
  });
}
