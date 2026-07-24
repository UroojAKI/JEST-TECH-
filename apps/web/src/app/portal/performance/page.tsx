'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Award, TrendingUp, Target, Users, Shield } from 'lucide-react';

export default function AgentPerformancePage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" /> Agent Performance & Leaderboard Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">Monitor sales targets, policy conversion rates, customer ratings, and branch rankings</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Conversion Rate</span>
          <div className="text-lg font-black text-emerald-600">68.4%</div>
          <span className="text-[10px] text-muted-foreground">Leads to Issued</span>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Renewal Retention</span>
          <div className="text-lg font-black text-primary">94.2%</div>
          <span className="text-[10px] text-muted-foreground">Policy Renewals</span>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Customer CSAT</span>
          <div className="text-lg font-black text-amber-500">★ 4.9 / 5.0</div>
          <span className="text-[10px] text-muted-foreground">Based on 142 reviews</span>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Leaderboard</span>
          <div className="text-lg font-black text-emerald-600">Rank #3</div>
          <span className="text-[10px] text-muted-foreground">Mumbai BKC Branch</span>
        </div>
      </div>
    </AppShell>
  );
}
