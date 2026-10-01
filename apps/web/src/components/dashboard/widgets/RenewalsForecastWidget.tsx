'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, ExternalLink, Inbox } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

export function RenewalsForecastWidget() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['renewals-forecast-summary'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/policies/renewals/tasks?limit=5');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const renewals = Array.isArray(data) ? data : [];

  if (isLoading) {
    return (
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-48 bg-muted/40 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="h-5 w-5 text-blue-500" />
          <div>
            <h3 className="text-sm font-bold">Upcoming Policy Renewals</h3>
            <p className="text-[11px] text-muted-foreground">Policies due for renewal in the next 30 days</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/renewals')}
          className="flex items-center space-x-1 text-xs text-primary font-semibold hover:underline"
        >
          <span>Renewals</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {renewals.length > 0 ? (
        <div className="space-y-2 text-xs">
          {renewals.map((item: any) => (
            <div
              key={item.id}
              className="flex justify-between items-center py-2 border-b border-muted/30"
            >
              <span className="font-mono text-primary font-bold">
                {item.policyNumber || item.reference || item.id.slice(0, 8)}
              </span>
              <span className="truncate max-w-[150px]">{item.customerName || item.vehicleNumber || '--'}</span>
              <span className="font-bold text-xs">
                {item.premium ? `₹${Number(item.premium).toLocaleString('en-IN')}` : item.status || 'DUE'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <Inbox className="h-7 w-7 stroke-[1.5]" />
          <span className="text-xs font-medium">No pending renewals due</span>
        </div>
      )}
    </div>
  );
}
