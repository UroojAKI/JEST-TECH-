'use client';

import React, { useState } from 'react';
import { ShieldCheck, FileText, User, Wallet, Activity, Filter, Clock } from 'lucide-react';

interface ActivityItem {
  id: string;
  type: 'POLICIES' | 'CLAIMS' | 'RENEWALS' | 'LEADS' | 'FINANCE' | 'WORKFLOW';
  title: string;
  actor: string;
  timestamp: string;
  description: string;
}

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

export function FilteredActivityTimelineWidget() {
  const [filter, setFilter] = useState<string>('ALL');

  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['dashboard-activities'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const rawActivities: any[] = dashboardData?.widgets?.activities || [];
  const activities: ActivityItem[] = rawActivities.map((a) => ({
    id: a.id,
    type: a.badge || 'WORKFLOW',
    title: a.event,
    actor: 'System',
    timestamp: a.time,
    description: a.details,
  }));

  const filteredItems = activities.filter(
    (item) => filter === 'ALL' || item.type === filter
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center space-x-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold">Live Operational Activity Stream</h3>
        </div>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-1 text-[11px]">
          {['ALL', 'POLICIES', 'CLAIMS', 'RENEWALS', 'LEADS', 'FINANCE'].map((category) => (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                filter === category
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Timeline List */}
      <div className="space-y-3 pt-1">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No activity events recorded for category "{filter}".
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="flex space-x-3 text-xs border-b pb-3 last:border-0 last:pb-0">
              <div className="p-2 rounded-lg bg-primary/10 text-primary h-fit">
                {item.type === 'POLICIES' && <ShieldCheck className="h-4 w-4" />}
                {item.type === 'CLAIMS' && <FileText className="h-4 w-4" />}
                {item.type === 'LEADS' && <User className="h-4 w-4" />}
                {item.type === 'FINANCE' && <Wallet className="h-4 w-4" />}
                {item.type === 'RENEWALS' && <Clock className="h-4 w-4" />}
              </div>

              <div className="flex-1 space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">{item.title}</span>
                  <span className="text-[10px] text-muted-foreground">{item.timestamp}</span>
                </div>
                <p className="text-muted-foreground text-[11px]">{item.description}</p>
                <div className="text-[10px] text-primary/80 font-medium pt-0.5">By {item.actor}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
