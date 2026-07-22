'use client';

import { useQuery } from '@tanstack/react-query';
import { dashboardRepository } from '../repositories/dashboard.repository';
import { DashboardFilterParams, RefreshIntervalOption } from '../types/dashboard';
import { RoleType } from '../types';

export function useDashboardWidget(
  role: RoleType | undefined,
  params?: DashboardFilterParams
) {
  const getIntervalMs = (strategy?: RefreshIntervalOption): number | false => {
    if (strategy === '60s') return 60000;
    if (strategy === 'PAUSED' || strategy === 'MANUAL') return false;
    return 30000; // Default 30s
  };

  const refetchInterval = getIntervalMs(params?.refreshStrategy);

  const query = useQuery({
    queryKey: ['dashboard', role, params],
    queryFn: async () => {
      if (role === 'SUPER_ADMIN') {
        return dashboardRepository.getSuperAdminDashboard(params);
      }
      if (role === 'ADMIN') {
        return dashboardRepository.getAdminDashboard(params);
      }
      if (role === 'BRANCH_MANAGER') {
        return dashboardRepository.getManagerDashboard(params);
      }
      if (role === 'SALES_AGENT') {
        return dashboardRepository.getAgentDashboard(params);
      }
      return dashboardRepository.getDashboardData(params);
    },
    refetchInterval,
    staleTime: 15000,
    retry: 2,
  });

  return {
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}
