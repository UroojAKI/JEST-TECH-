'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminRepository } from '../repositories/admin.repository';
import { toast } from 'sonner';

export function useAdminDashboard() {
  return useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => adminRepository.getDashboardMetrics(),
  });
}

export function useAdminUsers(params?: { status?: string; role?: string; search?: string }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => adminRepository.getUsers(params),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => adminRepository.updateUserStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User status updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    },
  });

  return {
    users: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    updateUserStatus: updateStatusMutation.mutate,
    isUpdating: updateStatusMutation.isPending,
  };
}

export function useAdminRoles() {
  return useQuery({
    queryKey: ['admin-roles'],
    queryFn: () => adminRepository.getRoles(),
  });
}

export function useAdminBranches() {
  return useQuery({
    queryKey: ['admin-branches'],
    queryFn: () => adminRepository.getBranches(),
  });
}

export function useAdminLookups(type?: string) {
  return useQuery({
    queryKey: ['admin-lookups', type],
    queryFn: () => adminRepository.getLookups(type),
  });
}

export function useNumberSeries() {
  return useQuery({
    queryKey: ['admin-number-series'],
    queryFn: () => adminRepository.getNumberSeries(),
  });
}

export function useSystemConfig() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-system-config'],
    queryFn: () => adminRepository.getSystemConfig(),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: any) => adminRepository.updateSystemConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-system-config'] });
      toast.success('System configuration updated successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update configuration');
    },
  });

  return {
    config: query.data,
    isLoading: query.isLoading,
    updateConfig: updateConfigMutation.mutate,
    isUpdating: updateConfigMutation.isPending,
  };
}

export function useFeatureFlags() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['admin-feature-flags'],
    queryFn: () => adminRepository.getFeatureFlags(),
  });

  const toggleFlagMutation = useMutation({
    mutationFn: ({ id, isEnabled }: { id: string; isEnabled: boolean }) => adminRepository.toggleFeatureFlag(id, isEnabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-feature-flags'] });
      toast.success('Feature flag state updated!');
    },
  });

  return {
    flags: query.data || [],
    isLoading: query.isLoading,
    toggleFlag: toggleFlagMutation.mutate,
  };
}

export function useAuditLogs(params?: { search?: string; module?: string }) {
  return useQuery({
    queryKey: ['admin-audit-logs', params],
    queryFn: () => adminRepository.getAuditLogs(params),
  });
}

export function useSystemHealth() {
  return useQuery({
    queryKey: ['admin-system-health'],
    queryFn: () => adminRepository.getSystemHealth(),
    refetchInterval: 15000,
  });
}
