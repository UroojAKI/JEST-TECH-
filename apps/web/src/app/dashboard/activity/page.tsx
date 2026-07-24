'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Activity, Search, Filter, Layers, UserCheck, Shield, FileText, CheckCircle2 } from 'lucide-react';

const MOCK_GLOBAL_ACTIVITIES = [
  { id: 'ACT-001', module: 'POLICIES', event: 'Policy Issued', summary: 'Motor Policy POL-001048 issued for Rahul Patil (ICICI Lombard)', user: 'System Auto-Issue', branch: 'Mumbai BKC', timestamp: '10 mins ago' },
  { id: 'ACT-002', module: 'CLAIMS', event: 'Claim Registered', summary: 'Claim CLM-2026-0042 (₹3.84L) registered for Acme Logistics', user: 'Priya Nair', branch: 'Pune Branch', timestamp: '25 mins ago' },
  { id: 'ACT-003', module: 'FINANCE', event: 'Commission Approved', summary: 'Commission COMM-1001 (₹1,654.50) approved for Rajesh Sharma', user: 'Sunil Verma', branch: 'Mumbai BKC', timestamp: '1 hour ago' },
  { id: 'ACT-004', module: 'LEADS', event: 'Lead Converted', summary: 'Lead LEAD-8812 (Health Optima) converted to Proposal PRP-2026-0091', user: 'Rajesh Sharma', branch: 'Mumbai BKC', timestamp: '2 hours ago' },
  { id: 'ACT-005', module: 'ADMIN', event: 'User Provisioned', summary: 'New Sales Agent account provisioned for Vikram Mehta (Delhi CP)', user: 'System Admin', branch: 'Corporate HQ', timestamp: '4 hours ago' },
];

export default function GlobalActivityFeedPage() {
  const [selectedModule, setSelectedModule] = useState<string>('ALL');

  const filteredActivities = MOCK_GLOBAL_ACTIVITIES.filter((a) => {
    if (selectedModule === 'ALL') return true;
    return a.module === selectedModule;
  });

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" /> Enterprise Real-Time Global Activity Feed
          </h1>
          <p className="text-xs text-muted-foreground">Unified operational activity stream across all brokerage branches, modules, and user actions</p>
        </div>
      </div>

      {/* Module Filters */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {['ALL', 'POLICIES', 'CLAIMS', 'FINANCE', 'LEADS', 'ADMIN'].map((mod) => (
          <button
            key={mod}
            onClick={() => setSelectedModule(mod)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedModule === mod
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {mod}
          </button>
        ))}
      </div>

      {/* Activity Timeline Stream */}
      <div className="space-y-3 text-xs">
        {filteredActivities.map((act) => (
          <div key={act.id} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {act.module}
                </span>
                <span className="font-extrabold text-foreground text-sm">{act.event}</span>
              </div>
              <p className="text-muted-foreground text-xs">{act.summary}</p>
            </div>

            <div className="text-right text-[10px] text-muted-foreground">
              <div className="font-bold text-foreground">{act.user}</div>
              <div>{act.branch}</div>
              <div className="font-mono">{act.timestamp}</div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
