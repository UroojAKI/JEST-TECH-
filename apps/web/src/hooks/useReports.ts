'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsRepository, ExecuteReportParams } from '../repositories/reports.repository';
import { toast } from 'sonner';

export function useReports(params?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: ['reports', params],
    queryFn: () => reportsRepository.getReports(params),
  });
}

export function useReportDetails(id: string) {
  return useQuery({
    queryKey: ['report-details', id],
    queryFn: () => reportsRepository.getReport(id),
    enabled: !!id,
  });
}

export function useExecuteReport(id: string, params?: ExecuteReportParams) {
  return useQuery({
    queryKey: ['execute-report', id, params],
    queryFn: () => reportsRepository.executeReport(id, params),
    enabled: !!id,
  });
}

export function useReportProviders() {
  return useQuery({
    queryKey: ['report-providers'],
    queryFn: () => reportsRepository.getDataProviders(),
  });
}

export function useReportSchedules() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['report-schedules'],
    queryFn: () => reportsRepository.getSchedules(),
  });

  const createScheduleMutation = useMutation({
    mutationFn: (data: any) => reportsRepository.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-schedules'] });
      toast.success('Report schedule created successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create schedule');
    },
  });

  return {
    schedules: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    createSchedule: createScheduleMutation.mutate,
    isCreating: createScheduleMutation.isPending,
  };
}

export function useReportHistory() {
  return useQuery({
    queryKey: ['report-history'],
    queryFn: () => reportsRepository.getExecutionHistory(),
  });
}
