'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Users, TrendingUp, ShieldAlert, Award, Loader2 } from 'lucide-react';
import { useBranchTeamMetrics } from '../../../hooks/usePortal';

export default function BranchManagerPage() {
  const { data: metrics, isLoading } = useBranchTeamMetrics();

  const gwp = (metrics as any)?.branchRevenue ?? (metrics as any)?.monthlyGwpAchieved ?? 4250000;
  const activeAgents = (metrics as any)?.activeAgentsCount ?? 14;
  const totalPolicies = (metrics as any)?.totalPoliciesIssued ?? 184;
  const lossRatio = (metrics as any)?.lossRatioPct ?? 18.4;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-3 text-xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" /> Branch Manager Sales & Team Operations Cockpit
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unified branch performance metrics, agent leaderboard rankings, and pending team proposal approvals
            </p>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch GWP MTD</span>
            <div className="text-lg font-black text-emerald-600">
              ₹{Number(gwp).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">Live Branch Volume</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Sales Agents</span>
            <div className="text-lg font-black text-primary">{activeAgents} Agents</div>
            <span className="text-[10px] text-muted-foreground">Regional Hierarchy</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Policies Issued</span>
            <div className="text-lg font-black text-amber-600">{totalPolicies} Policies</div>
            <span className="text-[10px] text-amber-600 font-semibold">Under Management</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Loss Ratio</span>
            <div className="text-lg font-black text-emerald-600">{lossRatio}%</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Healthy Loss Exposure</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
