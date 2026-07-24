'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Users, TrendingUp, ShieldAlert, Award } from 'lucide-react';
import { useBranchTeamMetrics } from '../../../hooks/usePortal';

export default function BranchManagerPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Branch Manager Sales & Team Operations Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">Unified branch performance metrics, agent leaderboard rankings, and pending team proposal approvals</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch GWP MTD</span>
          <div className="text-lg font-black text-emerald-600">₹1,84,00,000</div>
          <span className="text-[10px] text-emerald-600 font-semibold">102.2% of Target</span>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Sales Agents</span>
          <div className="text-lg font-black text-primary">42 Agents</div>
          <span className="text-[10px] text-muted-foreground">Mumbai BKC Branch</span>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Approvals</span>
          <div className="text-lg font-black text-amber-600">4 Requests</div>
          <span className="text-[10px] text-amber-600 font-semibold">High Value Proposals</span>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Loss Ratio</span>
          <div className="text-lg font-black text-emerald-600">42.1%</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Healthy Loss Exposure</span>
        </div>
      </div>
    </AppShell>
  );
}
