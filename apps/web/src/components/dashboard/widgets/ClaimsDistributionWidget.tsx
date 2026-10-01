'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ShieldAlert, ExternalLink, Inbox } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

export function ClaimsDistributionWidget() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ['claims-distribution-summary'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/claims?limit=5');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const claims = Array.isArray(data) ? data : [];

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
          <ShieldAlert className="h-5 w-5 text-amber-500" />
          <div>
            <h3 className="text-sm font-bold">Claims Distribution</h3>
            <p className="text-[11px] text-muted-foreground">Active claims and settlement tracking</p>
          </div>
        </div>

        <button
          onClick={() => router.push('/claims')}
          className="flex items-center space-x-1 text-xs text-primary font-semibold hover:underline"
        >
          <span>All Claims</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      {claims.length > 0 ? (
        <div className="space-y-2 text-xs">
          {claims.map((claim: any) => (
            <div
              key={claim.id}
              className="flex justify-between items-center py-2 border-b border-muted/30"
            >
              <span className="font-mono text-primary font-bold">
                {claim.claimNumber || claim.claimCode || claim.id.slice(0, 8)}
              </span>
              <span className="truncate max-w-[150px]">{claim.claimantName || claim.policyNumber || '--'}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted">
                {claim.status || 'SUBMITTED'}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <Inbox className="h-7 w-7 stroke-[1.5]" />
          <span className="text-xs font-medium">No open claims registered</span>
        </div>
      )}
    </div>
  );
}
