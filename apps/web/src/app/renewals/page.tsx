'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/app-shell';
import {
  RotateCcw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowRight,
  Send,
  ShieldAlert,
  Loader2,
  TrendingUp,
  Award,
} from 'lucide-react';
import Link from 'next/link';
import { policiesRepository } from '../../repositories/policies.repository';

export default function RenewalsWorkspacePage() {
  const queryClient = useQueryClient();
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL');
  const [search, setSearch] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  // Fetch Live Telemetry KPIs
  const { data: kpis = {}, isLoading: isKpisLoading } = useQuery({
    queryKey: ['renewals-kpis'],
    queryFn: () => policiesRepository.getRenewalKpis(),
  });

  // Fetch Authoritative Renewal Queue
  const { data: queueResponse = { data: [], summary: {} }, isLoading: isQueueLoading, refetch } = useQuery({
    queryKey: ['renewals-queue', urgencyFilter, search],
    queryFn: () =>
      policiesRepository.getRenewalQueue({
        urgency: urgencyFilter,
        search,
      }),
  });

  const queueItems = queueResponse.data || [];
  const summary = queueResponse.summary || {};

  const handleSendReminder = async (policyId: string) => {
    setRemindingId(policyId);
    try {
      const res = await policiesRepository.sendRenewalReminder(policyId);
      toast.success(res.message || 'Renewal reminder dispatched!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to dispatch reminder');
    } finally {
      setRemindingId(null);
    }
  };

  const handleEscalate = async (policyId: string) => {
    setEscalatingId(policyId);
    try {
      const res = await policiesRepository.escalateRenewal(policyId);
      toast.success(res.message || 'Policy renewal escalated to Branch Manager!');
      void refetch();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to escalate renewal');
    } finally {
      setEscalatingId(null);
    }
  };

  return (
    <AppShell activeWorkspace="RENEWALS">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-primary" />
              Renewals & Retention Command Center (R10)
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Automated expiry tracking, early renewal generation ($T-60$, $T-30$, $T-15$, $T-7$ days), NCB roll-over calculation, and customer retention SLA pipeline.
            </p>
          </div>
        </div>

        {/* Real KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Due Today</span>
            <span className="text-xl font-black text-primary mt-1 block">{kpis.dueToday ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-red-500/5 border-red-500/20 shadow-xs">
            <span className="text-[11px] font-bold text-red-600 block">Critical (&le; 7 Days)</span>
            <span className="text-xl font-black text-red-600 mt-1 block">{summary.criticalCount ?? kpis.in7Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20 shadow-xs">
            <span className="text-[11px] font-bold text-amber-600 block">High (&le; 15 Days)</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">{summary.highCount ?? kpis.in15Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Medium (&le; 30 Days)</span>
            <span className="text-xl font-black text-foreground mt-1 block">{summary.mediumCount ?? kpis.in30Days ?? 0}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-card shadow-xs">
            <span className="text-[11px] font-bold text-muted-foreground block">Conversion Rate</span>
            <span className="text-xl font-black text-foreground mt-1 block">{kpis.conversionPercentage || '0%'}</span>
          </div>
          <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/20 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 block">Recovered Revenue</span>
            <span className="text-sm font-black text-emerald-700 mt-1 block">{kpis.recoveredRevenue || '₹0'}</span>
          </div>
        </div>

        {/* Filter Controls & Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search policy, customer, or vehicle plate..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Urgency Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-muted/40 rounded-xl border">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((urgency) => (
              <button
                key={urgency}
                onClick={() => setUrgencyFilter(urgency)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  urgencyFilter === urgency
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {urgency === 'ALL' ? 'All Expiring' : urgency}
              </button>
            ))}
          </div>
        </div>

        {/* Renewal Worklist Table */}
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground">Expiring Policies Queue (NCB Roll-over & Reminders)</span>
            <span className="text-[11px] text-muted-foreground font-semibold">{queueItems.length} Policies</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Policy Number</th>
                  <th className="px-5 py-3">Customer & Vehicle</th>
                  <th className="px-5 py-3">Expiry Date & SLA</th>
                  <th className="px-5 py-3">NCB Roll-over</th>
                  <th className="px-5 py-3">Est. Renewal Premium</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isQueueLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span>Loading renewal worklist...</span>
                      </div>
                    </td>
                  </tr>
                ) : queueItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No renewal policies found matching filter.
                    </td>
                  </tr>
                ) : (
                  queueItems.map((item: any) => (
                    <tr key={item.id} className="hover:bg-muted/20 transition">
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-bold text-primary">{item.policyNumber}</div>
                        <div className="text-[10px] text-muted-foreground">{item.insurerName}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">{item.customerName}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{item.customerPhone || 'No phone'}</span>
                          <span>•</span>
                          <span className="font-mono text-[10px] uppercase font-bold text-foreground/80">{item.registrationNumber}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">
                          {new Date(item.expiryDate).toLocaleDateString('en-IN')}
                        </div>
                        <div className="mt-1 flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.urgency === 'CRITICAL'
                                ? 'bg-red-500/10 text-red-600'
                                : item.urgency === 'HIGH'
                                  ? 'bg-amber-500/10 text-amber-600'
                                  : item.urgency === 'MEDIUM'
                                    ? 'bg-blue-500/10 text-blue-600'
                                    : 'bg-emerald-500/10 text-emerald-600'
                            }`}
                          >
                            {item.daysRemaining < 0 ? 'EXPIRED' : `${item.daysRemaining} days left`}
                          </span>
                          {item.escalated && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-600 text-white">
                              ESCALATED
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <Award className="h-3.5 w-3.5 text-primary" />
                          <span className="font-semibold text-foreground">
                            {item.currentNcb}% → <strong>{item.nextNcb}%</strong>
                          </span>
                        </div>
                        {item.hasClaims ? (
                          <div className="text-[10px] text-red-500 font-medium">Claim reported (NCB reset)</div>
                        ) : (
                          <div className="text-[10px] text-emerald-600 font-medium">No-claim discount bonus</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground font-mono">
                          ₹{item.estimatedRenewalPremium.toLocaleString('en-IN')}
                        </div>
                        <div className="text-[10px] text-muted-foreground line-through">
                          ₹{item.lastPremium.toLocaleString('en-IN')}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-1.5">
                        <button
                          onClick={() => handleSendReminder(item.id)}
                          disabled={remindingId === item.id}
                          title="Dispatch instant reminder SMS/Email"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-xs transition"
                        >
                          {remindingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5 text-primary" />
                          )}
                          <span>Remind</span>
                        </button>

                        {!item.escalated && item.urgency === 'CRITICAL' && (
                          <button
                            onClick={() => handleEscalate(item.id)}
                            disabled={escalatingId === item.id}
                            title="Escalate to Branch Manager"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-600 text-xs font-semibold transition"
                          >
                            {escalatingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
                            )}
                            <span>Escalate</span>
                          </button>
                        )}

                        <Link
                          href={`/sales/quotations?renewPolicyId=${item.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-xs"
                        >
                          <span>Renew</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
