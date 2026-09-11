'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Award, TrendingUp, Target, Users, Shield, Loader2 } from 'lucide-react';
import { useAgentDashboard } from '../../../hooks/usePortal';

export default function AgentPerformancePage() {
  const { data: dashboard, isLoading } = useAgentDashboard();

  const totalLeads = (dashboard as any)?.totalLeads ?? 0;
  const activePolicies = (dashboard as any)?.activePolicies ?? 0;
  const targetAchieved = (dashboard as any)?.targetAchievementPct ?? 0;
  const conversionRate = totalLeads > 0 ? Math.round((activePolicies / totalLeads) * 1000) / 10 : 0;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-3 text-xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Award className="h-5 w-5 text-amber-500" /> Agent Performance & Leaderboard Cockpit
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Monitor sales targets, policy conversion rates, customer ratings, and branch rankings
            </p>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Conversion Rate</span>
            <div className="text-lg font-black text-emerald-600">{conversionRate}%</div>
            <span className="text-[10px] text-muted-foreground">Leads to Issued Policies</span>
          </div>
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Achievement</span>
            <div className="text-lg font-black text-primary">{targetAchieved}%</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Monthly Sales Quota</span>
          </div>
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Portfolio</span>
            <div className="text-lg font-black text-amber-500">{activePolicies} Active</div>
            <span className="text-[10px] text-muted-foreground">Policies Serviced</span>
          </div>
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Leaderboard</span>
            <div className="text-lg font-black text-emerald-600">{(dashboard as any)?.branchRank ? `Rank #${(dashboard as any).branchRank}` : 'Unranked'}</div>
            <span className="text-[10px] text-muted-foreground">{(dashboard as any)?.branchName || 'Your Branch'}</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
