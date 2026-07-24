'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Plus, Users, MapPin, TrendingUp, Shield } from 'lucide-react';
import { useAdminBranches } from '../../../hooks/useAdmin';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_BRANCHES = [
  {
    id: 'BR-01',
    code: 'BOM-BKC',
    name: 'Mumbai BKC Flagship Branch',
    city: 'Mumbai',
    state: 'Maharashtra',
    managerName: 'Sunil Verma',
    staffCount: 42,
    activePolicies: 4850,
    monthlyGwp: 18400000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-02',
    code: 'PUN-SHV',
    name: 'Pune Shivajinagar Branch',
    city: 'Pune',
    state: 'Maharashtra',
    managerName: 'Rajesh Sharma',
    staffCount: 28,
    activePolicies: 3200,
    monthlyGwp: 14200000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-03',
    code: 'BLR-IND',
    name: 'Bengaluru Indiranagar Tech Branch',
    city: 'Bengaluru',
    state: 'Karnataka',
    managerName: 'Priya Nair',
    staffCount: 24,
    activePolicies: 2800,
    monthlyGwp: 10500000,
    status: 'ACTIVE',
  },
  {
    id: 'BR-04',
    code: 'DEL-CP',
    name: 'Delhi Connaught Place Branch',
    city: 'New Delhi',
    state: 'Delhi',
    managerName: 'Vikram Mehta',
    staffCount: 16,
    activePolicies: 1630,
    monthlyGwp: 5400000,
    status: 'ACTIVE',
  },
];

export default function BranchManagementPage() {
  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Branch & Organizational Hierarchy Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Manage regional brokerage branches, department mappings, sales teams, and manager scoping</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Opening Create New Branch Modal...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create New Branch</span>
          </button>
        </div>
      </div>

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {MOCK_BRANCHES.map((b) => (
          <div key={b.id} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <span className="font-mono font-bold text-[10px] text-primary">{b.code}</span>
                <h3 className="font-extrabold text-sm text-foreground">{b.name}</h3>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3" /> {b.city}, {b.state}
                </span>
              </div>
              <StatusBadge status={b.status} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Branch Head</span>
                <div className="font-bold text-foreground truncate">{b.managerName}</div>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Staff Count</span>
                <div className="font-bold text-primary">{b.staffCount} Execs</div>
              </div>
              <div className="p-2.5 rounded-lg border bg-muted/10">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Active Policies</span>
                <div className="font-bold text-emerald-600">{b.activePolicies.toLocaleString('en-IN')}</div>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 flex justify-between items-center font-bold">
              <span>Monthly GWP Contribution:</span>
              <span className="text-sm font-mono font-black">₹{b.monthlyGwp.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
