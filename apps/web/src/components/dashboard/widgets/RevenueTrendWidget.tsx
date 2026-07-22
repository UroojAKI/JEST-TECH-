'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UnifiedChart } from '../../charts/unified-chart';
import { TrendingUp, ExternalLink } from 'lucide-react';

interface RevenueTrendProps {
  data?: any[];
  isLoading?: boolean;
  isError?: boolean;
}

const DEFAULT_REVENUE = [
  { month: 'Jan 2026', GWP: 4500000 },
  { month: 'Feb 2026', GWP: 5200000 },
  { month: 'Mar 2026', GWP: 6100000 },
  { month: 'Apr 2026', GWP: 5800000 },
  { month: 'May 2026', GWP: 7300000 },
  { month: 'Jun 2026', GWP: 8900000 },
];

export function RevenueTrendWidget({ data = DEFAULT_REVENUE, isLoading, isError }: RevenueTrendProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-64 bg-muted/40 rounded-lg" />
      </div>
    );
  }

  if (isError) {
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
            <p className="text-[11px] text-muted-foreground">Click chart points to drill down into branch ledgers</p>
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
        data={data}
        dataKey="GWP"
        categoryKey="month"
        height={280}
        colors={['#10b981']}
      />
    </div>
  );
}
