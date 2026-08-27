'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/app-shell';
import {
  RotateCcw,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  TrendingUp,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function RenewalsWorkspacePage() {
  const queryClient = useQueryClient();
  const [activeBucket, setActiveBucket] = useState<'ALL' | 'DUE_TODAY' | 'IN_7_DAYS' | 'IN_15_DAYS' | 'IN_30_DAYS' | 'OVERDUE'>('ALL');
  const [search, setSearch] = useState('');

  // Fetch Live Telemetry KPIs
  const { data: kpis = {}, isLoading: isKpisLoading } = useQuery({
    queryKey: ['renewals-kpis'],
    queryFn: async () => {
      const res = await apiClient.get('/policies/renewals/kpis');
      return res.data || {};
    },
  });

  // Fetch Upcoming Worklist
  const { data: upcomingTasks = [], isLoading: isTasksLoading } = useQuery({
    queryKey: ['renewals-upcoming'],
    queryFn: async () => {
      const res = await apiClient.get('/policies/renewals/upcoming');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const tasks = Array.isArray(upcomingTasks) ? upcomingTasks : [];

  const filteredTasks = tasks.filter((task: any) => {
    const policy = task.policy || {};
    const contact = policy.contact || {};
    const searchMatch =
      !search ||
      (policy.policyNumber && policy.policyNumber.toLowerCase().includes(search.toLowerCase())) ||
      (`${contact.firstName} ${contact.lastName}`.toLowerCase().includes(search.toLowerCase())) ||
      (contact.phone && contact.phone.includes(search));

    return searchMatch;
  });

  return (
    <AppShell activeWorkspace="RENEWALS">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-primary" />
              Renewals & Retention Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Automated expiry tracking, early renewal generation (30 days prior), and customer retention pipeline.
            </p>
          </div>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Due Today</span>
            <span className="text-xl font-black text-primary mt-1 block">{kpis.dueToday ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Next 7 Days</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">{kpis.in7Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Next 15 Days</span>
            <span className="text-xl font-black text-foreground mt-1 block">{kpis.in15Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Next 30 Days</span>
            <span className="text-xl font-black text-foreground mt-1 block">{kpis.in30Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Overdue / Lapsed</span>
            <span className="text-xl font-black text-red-600 mt-1 block">{kpis.overdue ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 block">Recovered Sum</span>
            <span className="text-sm font-black text-emerald-700 mt-1 block">{kpis.recoveredRevenue || '₹0'}</span>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by policy number, customer name, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Renewal Worklist Table */}
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground">Expiring Policies Queue</span>
            <span className="text-[11px] text-muted-foreground font-semibold">{filteredTasks.length} Policies</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Policy Number</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Expiry Date</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isTasksLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading renewal worklist...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No renewal tasks found.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task: any) => {
                    const policy = task.policy || {};
                    const contact = policy.contact || {};
                    return (
                      <tr key={task.id} className="hover:bg-muted/20 transition">
                        <td className="px-5 py-3.5 font-mono font-bold text-primary">
                          {policy.policyNumber || 'POL-UNKNOWN'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-foreground">
                            {contact.firstName} {contact.lastName}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{contact.phone || 'No phone'}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-foreground">
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN') : 'N/A'}
                          </div>
                          <div className="text-[10px] text-muted-foreground">Expires Soon</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              task.priority === 'HIGH'
                                ? 'bg-red-500/10 text-red-600'
                                : 'bg-amber-500/10 text-amber-600'
                            }`}
                          >
                            {task.priority || 'MEDIUM'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                            {task.status || 'PENDING'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right space-x-2">
                          <Link
                            href={`/sales/quotations?renewPolicyId=${policy.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-xs"
                          >
                            Generate Renewal Quote
                            <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
