'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Clock, AlertTriangle, ShieldCheck, Zap, Users, TrendingUp } from 'lucide-react';
import { useSlaMetrics } from '../../../hooks/useWorkflows';

export default function SlaDashboardPage() {
  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" /> Operational SLA & Turnaround Time Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">Monitor SLA breach counters, department turnaround velocities, and bottleneck stage delays</p>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Approvals Due Today</span>
          <div className="text-lg font-black text-primary">18 Requests</div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">SLA Overdue</span>
          <div className="text-lg font-black text-red-600">2 Breached</div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Escalations Active</span>
          <div className="text-lg font-black text-amber-600">3 Escalated</div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Average Approval</span>
          <div className="text-lg font-black text-emerald-600">3h 12m</div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Fastest Department</span>
          <div className="text-lg font-black text-emerald-600">Finance (45m)</div>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Slowest Department</span>
          <div className="text-lg font-black text-amber-600">Underwriting (6h)</div>
        </div>
      </div>

      {/* SLA Breakdown by Department */}
      <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
        <h3 className="font-bold text-sm text-foreground">Departmental SLA Velocity & Breaches</h3>

        <div className="space-y-3">
          {[
            { dept: 'Commercial Underwriting', avgHours: '5h 45m', slaTarget: '8h 00m', compliance: '92.4%', status: 'GOOD' },
            { dept: 'Claims Operations & Survey', avgHours: '4h 10m', slaTarget: '6h 00m', compliance: '96.8%', status: 'EXCELLENT' },
            { dept: 'Accounts & Finance Payouts', avgHours: '0h 45m', slaTarget: '2h 00m', compliance: '99.2%', status: 'EXCELLENT' },
            { dept: 'Branch Managers (Escalations)', avgHours: '7h 15m', slaTarget: '6h 00m', compliance: '84.0%', status: 'NEEDS_ATTENTION' },
          ].map((item, idx) => (
            <div key={idx} className="p-4 rounded-xl border bg-muted/10 flex justify-between items-center">
              <div className="space-y-0.5">
                <div className="font-bold text-foreground text-sm">{item.dept}</div>
                <div className="text-muted-foreground text-[10px]">Target: {item.slaTarget} • Actual: {item.avgHours}</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-black text-emerald-600 text-sm">{item.compliance}</div>
                <span className="text-[10px] text-muted-foreground">SLA Compliance</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
