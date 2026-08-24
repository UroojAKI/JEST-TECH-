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
      if (!role) return dashboardRepository.getDashboardData(params);
      const r = String(role).toUpperCase();
      if (r === 'SUPER_ADMIN' || r === 'ADMIN' || r === 'MD_CEO') {
        return dashboardRepository.getSuperAdminDashboard(params);
      }
      if (r === 'SALES_DIRECTOR' || r === 'CHIEF_FINANCE_OFFICER' || r === 'UNDERWRITING_MANAGER') {
        return dashboardRepository.getAdminDashboard(params);
      }
      if (r === 'BRANCH_MANAGER' || r === 'TEAM_LEADER') {
        return dashboardRepository.getManagerDashboard(params);
      }
      if (r === 'SALES_AGENT' || r === 'POSP_ADVISOR' || r === 'RENEWAL_EXECUTIVE' || r === 'CLAIMS_EXECUTIVE' || r === 'FINANCE_EXECUTIVE' || r === 'CUSTOMER_SERVICE_EXECUTIVE') {
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
