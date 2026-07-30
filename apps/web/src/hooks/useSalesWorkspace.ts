'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salesWorkspaceRepository } from '../repositories/sales-workspace.repository';
import { toast } from 'sonner';

export function useSalesWorkspace() {
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ['sales-workspace-dashboard'],
    queryFn: () => salesWorkspaceRepository.getDashboard(),
  });

  const kpisQuery = useQuery({
    queryKey: ['sales-workspace-kpis'],
    queryFn: () => salesWorkspaceRepository.getKpis(),
  });

  const pipelineQuery = useQuery({
    queryKey: ['sales-workspace-pipeline'],
    queryFn: () => salesWorkspaceRepository.getPipeline(),
  });

  const moveStageMutation = useMutation({
    mutationFn: ({ leadId, targetStage, overrideReason, remarks }: { leadId: string; targetStage: string; overrideReason?: string; remarks?: string }) =>
      salesWorkspaceRepository.moveStage(leadId, targetStage, overrideReason, remarks),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-workspace-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sales-workspace-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stage-history'] });
      toast.success(
        data.isOverride
          ? `Workflow stage overridden to ${data.toStage} with manager audit log.`
          : `Lead stage advanced to ${data.toStage}!`
      );
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to move workflow stage');
    },
  });

  const createReferralMutation = useMutation({
    mutationFn: ({ leadId, data }: { leadId: string; data: any }) => salesWorkspaceRepository.createReferral(leadId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-workspace-dashboard'] });
      toast.success('Referral recorded and linked lead provisioned!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to capture referral');
    },
  });

  return {
    dashboard: dashboardQuery.data,
    isDashboardLoading: dashboardQuery.isLoading,
    kpis: kpisQuery.data,
    pipeline: pipelineQuery.data,
    isPipelineLoading: pipelineQuery.isLoading,
    moveStage: moveStageMutation.mutate,
    isMovingStage: moveStageMutation.isPending,
    createReferral: createReferralMutation.mutate,
  };
}
