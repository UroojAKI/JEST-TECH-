'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { UnifiedChart } from '../../charts/unified-chart';
import { TrendingUp, ExternalLink } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

interface RevenueTrendProps {
  data?: any[];
  isLoading?: boolean;
  isError?: boolean;
}

export function RevenueTrendWidget({ data: propData, isLoading: propLoading, isError: propError }: RevenueTrendProps) {
  const router = useRouter();

  const {
    data: fetchedData,
    isLoading: fetchLoading,
    isError: fetchError,
  } = useQuery({
    queryKey: ['revenue-monthly-trend'],
    queryFn: async () => {
      const res = await apiClient.get('/analytics/revenue/trend');
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !propData,
  });

  const chartData = propData || fetchedData || [];
  const loading = propLoading || (propData ? false : fetchLoading);
  const error = propError || (propData ? false : fetchError);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted/40 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm text-center text-xs py-12 text-destructive">
        Failed to load GWP revenue trend telemetry. <button onClick={() => window.location.reload()} className="underline font-bold ml-1">Retry</button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5 text-emerald-500" />
          <div>
            <h3 className="text-sm font-bold">Gross Written Premium (GWP) Trend</h3>
            <p className="text-[11px] text-muted-foreground">Authoritative rolling 6-month gross premium telemetry</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/reports/builder')}
          className="flex items-center space-x-1 text-xs text-primary font-semibold hover:underline"
        >
          <span>Full Report</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <UnifiedChart
        type="AREA"
        data={chartData}
        dataKey="GWP"
        categoryKey="month"
        height={260}
        colors={['#10b981']}
      />
    </div>
  );
}
