'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Trophy, Users, Inbox } from 'lucide-react';
import { apiClient } from '../../../lib/api-client';

export function TeamLeaderboardWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['sales-team-leaderboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard/management/leaderboard');
        return res.data?.data || res.data || [];
      } catch {
        return [];
      }
    },
  });

  const leaders = Array.isArray(data) ? data : [];

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
      <div className="flex items-center space-x-2">
        <Trophy className="h-5 w-5 text-amber-500" />
        <div>
          <h3 className="text-sm font-bold">Sales Leaderboard</h3>
          <p className="text-[11px] text-muted-foreground">Top performers by issued premium</p>
        </div>
      </div>

      {leaders.length > 0 ? (
        <div className="space-y-2 text-xs">
          {leaders.map((leader: any, idx: number) => (
            <div
              key={leader.id || idx}
              className="flex justify-between items-center py-2 border-b border-muted/30"
            >
              <div className="flex items-center space-x-2">
                <span className="font-mono text-muted-foreground font-bold">#{idx + 1}</span>
                <span className="font-medium truncate max-w-[130px]">{leader.name || leader.agentName}</span>
              </div>
              <span className="font-bold text-emerald-600">
                ₹{Number(leader.premium || 0).toLocaleString('en-IN')}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground space-y-2">
          <Users className="h-7 w-7 stroke-[1.5]" />
          <span className="text-xs font-medium">Performance data synchronizing</span>
        </div>
      )}
    </div>
  );
}
