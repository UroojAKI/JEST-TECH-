'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/app-shell';
import { PageLoadingState, PageErrorState } from '../../components/ui/page-states';
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
  Car,
  HeartPulse,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import Link from 'next/link';
import { policiesRepository } from '../../repositories/policies.repository';
import { apiClient } from '../../lib/api-client';
import { buildRenewalUrl, buildHealthRenewalUrl } from '../../lib/renewal-url';

export default function RenewalsWorkspacePage() {
  const queryClient = useQueryClient();
  const [urgencyFilter, setUrgencyFilter] = useState<
    'ALL' | '7_DAYS' | '15_DAYS' | '30_DAYS' | 'GT_30' | 'OVERDUE' | 'ESCALATED' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  >('ALL');
  const [productFilter, setProductFilter] = useState<'ALL' | 'MOTOR' | 'HEALTH'>('ALL');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [escalatingId, setEscalatingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Live Telemetry KPIs
  const { data: kpis = {}, isLoading: isKpisLoading } = useQuery({
    queryKey: ['renewals-kpis'],
    queryFn: () => policiesRepository.getRenewalKpis(),
  });

  // Fetch Policies for Cross-Reference Lookup
  const { data: policiesData = [] } = useQuery({
    queryKey: ['workspace-recent-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/policies', { params: { limit: 100 } });
      const items = res.data?.items || res.data?.data || (Array.isArray(res.data) ? res.data : []);
      return Array.isArray(items) ? items : [];
    },
    staleTime: 60 * 1000,
  });

  const policyMap = useMemo(() => {
    const map = new Map<string, any>();
    (Array.isArray(policiesData) ? policiesData : []).forEach((p: any) => {
      if (p.id) map.set(p.id, p);
      if (p.policyNumber) map.set(p.policyNumber, p);
    });
    return map;
  }, [policiesData]);

  const isHealthItem = (item: any): boolean => {
    if (!item) return false;
    const pt = String(item.productType || '').toUpperCase();
    if (pt === 'HEALTH') return true;
    const matched = policyMap.get(item.id) || policyMap.get(item.policyNumber);
    if (matched) {
      const policyType = String(matched.policyType || '').toUpperCase();
      const productLine = String(matched.productLine || '').toUpperCase();
      const productType = String(matched.quotation?.productType || '').toUpperCase();
      if (policyType === 'HEALTH' || productLine.includes('HEALTH') || productType === 'HEALTH') return true;
      if (Array.isArray(matched.members) && matched.members.length > 0) return true;
    }
    if ((!item.registrationNumber || item.registrationNumber === 'N/A') && !item.vehicleCategory) {
      if (matched && String(matched.policyType || '').toUpperCase() === 'HEALTH') return true;
    }
    return false;
  };

  // Fetch Authoritative Renewal Queue
  const { data: queueResponse = { data: [], summary: {} }, isLoading: isQueueLoading, isError: isQueueError, refetch } = useQuery({
    queryKey: ['renewals-queue', urgencyFilter, debouncedSearch],
    queryFn: () =>
      policiesRepository.getRenewalQueue({
        urgency: urgencyFilter,
        search: debouncedSearch,
        limit: 100,
      }),
  });

  const queueItems = useMemo(() => {
    let list = queueResponse.data || [];
    if (urgencyFilter && urgencyFilter !== 'ALL') {
      const u = urgencyFilter;
      list = list.filter((item: any) => {
        const days = item.daysRemaining ?? 0;
        if (u === '7_DAYS' || u === 'CRITICAL') return days >= 0 && days <= 7;
        if (u === '15_DAYS' || u === 'HIGH') return days >= 0 && days <= 15;
        if (u === '30_DAYS' || u === 'MEDIUM') return days >= 0 && days <= 30;
        if (u === 'GT_30' || u === 'LOW') return days > 30;
        if (u === 'OVERDUE') return days < 0;
        if (u === 'ESCALATED') return !!item.escalated;
        return true;
      });
    }
    return [...list].sort((a: any, b: any) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));
  }, [queueResponse.data, urgencyFilter]);

  const motorQueueItems = useMemo(() => queueItems.filter((item: any) => !isHealthItem(item)), [queueItems, policyMap]);
  const healthQueueItems = useMemo(() => queueItems.filter((item: any) => isHealthItem(item)), [queueItems, policyMap]);

  const displayedItems = useMemo(() => {
    if (productFilter === 'MOTOR') return motorQueueItems;
    if (productFilter === 'HEALTH') return healthQueueItems;
    return queueItems;
  }, [queueItems, motorQueueItems, healthQueueItems, productFilter]);

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
          <div
            onClick={() => setUrgencyFilter('7_DAYS')}
            className={`p-4 rounded-2xl border bg-card shadow-xs cursor-pointer transition hover:border-primary/50 ${
              urgencyFilter === '7_DAYS' || urgencyFilter === 'CRITICAL' ? 'ring-2 ring-primary/40' : ''
            }`}
          >
            <span className="text-[11px] font-bold text-muted-foreground block">Due Today</span>
            <span className="text-xl font-black text-primary mt-1 block">{kpis.dueToday ?? 0}</span>
          </div>
          <div
            onClick={() => setUrgencyFilter('7_DAYS')}
            className={`p-4 rounded-2xl border bg-red-500/5 border-red-500/20 shadow-xs cursor-pointer transition hover:border-red-500/50 ${
              urgencyFilter === '7_DAYS' || urgencyFilter === 'CRITICAL' ? 'ring-2 ring-red-500/50' : ''
            }`}
          >
            <span className="text-[11px] font-bold text-red-600 block">Critical (&le; 7 Days)</span>
            <span className="text-xl font-black text-red-600 mt-1 block">{summary.criticalCount ?? kpis.in7Days ?? 0}</span>
          </div>
          <div
            onClick={() => setUrgencyFilter('15_DAYS')}
            className={`p-4 rounded-2xl border bg-amber-500/5 border-amber-500/20 shadow-xs cursor-pointer transition hover:border-amber-500/50 ${
              urgencyFilter === '15_DAYS' || urgencyFilter === 'HIGH' ? 'ring-2 ring-amber-500/50' : ''
            }`}
          >
            <span className="text-[11px] font-bold text-amber-600 block">High (&le; 15 Days)</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">{summary.highCount ?? kpis.in15Days ?? 0}</span>
          </div>
          <div
            onClick={() => setUrgencyFilter('30_DAYS')}
            className={`p-4 rounded-2xl border bg-card shadow-xs cursor-pointer transition hover:border-primary/50 ${
              urgencyFilter === '30_DAYS' || urgencyFilter === 'MEDIUM' ? 'ring-2 ring-primary/40' : ''
            }`}
          >
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
              aria-label="Search renewals"
            />
          </div>

          {/* Urgency Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-muted/40 rounded-xl border">
            {[
              { id: 'ALL', label: 'All Expiring' },
              { id: '7_DAYS', label: '< 7 Days' },
              { id: '15_DAYS', label: '< 15 Days' },
              { id: '30_DAYS', label: '< 30 Days' },
              { id: 'GT_30', label: '> 30 Days' },
              { id: 'OVERDUE', label: 'Overdue' },
              { id: 'ESCALATED', label: 'Escalated' },
            ].map((tab) => {
              const isActive =
                urgencyFilter === tab.id ||
                (tab.id === '7_DAYS' && urgencyFilter === 'CRITICAL') ||
                (tab.id === '15_DAYS' && urgencyFilter === 'HIGH') ||
                (tab.id === '30_DAYS' && urgencyFilter === 'MEDIUM') ||
                (tab.id === 'GT_30' && urgencyFilter === 'LOW');
              return (
                <button
                  key={tab.id}
                  onClick={() => setUrgencyFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Line Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border bg-card/60">
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
            <button
              onClick={() => setProductFilter('ALL')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                productFilter === 'ALL'
                  ? 'bg-primary text-primary-foreground font-black shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>All Renewals ({queueItems.length})</span>
            </button>
            <button
              onClick={() => setProductFilter('MOTOR')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                productFilter === 'MOTOR'
                  ? 'bg-blue-600 text-white font-black shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground'
              }`}
            >
              <Car className="h-3.5 w-3.5" />
              <span>Motor Renewals ({motorQueueItems.length})</span>
            </button>
            <button
              onClick={() => setProductFilter('HEALTH')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all ${
                productFilter === 'HEALTH'
                  ? 'bg-rose-600 text-white font-black shadow-xs'
                  : 'bg-muted/40 hover:bg-muted text-muted-foreground'
              }`}
            >
              <HeartPulse className="h-3.5 w-3.5" />
              <span>Health Renewals ({healthQueueItems.length})</span>
            </button>
          </div>
          <span className="text-xs font-bold text-muted-foreground">{displayedItems.length} Policies</span>
        </div>

        {/* Renewal Worklist Table */}
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground">
              {productFilter === 'MOTOR'
                ? 'Expiring Motor Policies Queue (NCB Roll-over & Reminders)'
                : productFilter === 'HEALTH'
                  ? 'Expiring Health Policies Queue (Portability & Waiting Period Continuity)'
                  : 'Expiring Policies Queue (Multi-line Motor & Health)'}
            </span>
            <span className="text-[11px] text-muted-foreground font-semibold">{displayedItems.length} Policies</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Renewals list</caption>
              <thead className="bg-muted/40 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Policy Number</th>
                  <th className="px-5 py-3">
                    {productFilter === 'HEALTH' ? 'Proposer & Family' : productFilter === 'MOTOR' ? 'Customer & Vehicle' : 'Customer / Asset'}
                  </th>
                  <th className="px-5 py-3">Expiry Date & SLA</th>
                  <th className="px-5 py-3">
                    {productFilter === 'HEALTH' ? 'Continuity & Bonus' : 'NCB Roll-over / Continuity'}
                  </th>
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
                ) : displayedItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No renewal policies found matching filter.
                    </td>
                  </tr>
                ) : (
                  displayedItems.map((item: any) => {
                    const isHealth = isHealthItem(item);
                    const matchedPolicy = policyMap.get(item.id) || policyMap.get(item.policyNumber);
                    const membersCount = matchedPolicy?.members?.length || 1;

                    return (
                      <tr key={item.id} className="hover:bg-muted/20 transition">
                        <td className="px-5 py-3.5">
                          <div className={`font-mono font-bold ${isHealth ? 'text-rose-600' : 'text-primary'}`}>
                            {item.policyNumber}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase ${
                              isHealth ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            }`}>
                              {isHealth ? 'Health' : 'Motor'}
                            </span>
                            <span className="text-[10px] text-muted-foreground">{item.insurerName}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="font-bold text-foreground">{item.customerName}</div>
                          {isHealth ? (
                            <div className="text-[11px] text-rose-600 flex items-center gap-2 mt-0.5">
                              <span className="font-semibold">{membersCount} {membersCount === 1 ? 'Live' : 'Lives'} Covered</span>
                              <span>•</span>
                              <span className="text-muted-foreground font-mono text-[10px]">{item.customerPhone || 'Direct'}</span>
                            </div>
                          ) : (
                            <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                              <span>{item.customerPhone || 'No phone'}</span>
                              <span>•</span>
                              <span className="font-mono text-[10px] uppercase font-bold text-foreground/80">{item.registrationNumber}</span>
                            </div>
                          )}
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
                          {isHealth ? (
                            <div>
                              <div className="flex items-center gap-1.5 text-emerald-600 font-semibold text-xs">
                                <ShieldCheck className="h-3.5 w-3.5" />
                                <span>Waiting Period Continuity</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground">Cumulative Bonus Protected</div>
                            </div>
                          ) : (
                            <div>
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
                            </div>
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
                            aria-label={`Send reminder to ${item.customerName}`}
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
                              aria-label={`Escalate ${item.policyNumber}`}
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

                          {isHealth ? (
                            <Link
                              href={buildHealthRenewalUrl(item.id, {
                                contactId: item.contactId || matchedPolicy?.contactId,
                                leadId: item.leadId || matchedPolicy?.leadId,
                              })}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition shadow-xs"
                            >
                              <span>Renew Health</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <Link
                              href={buildRenewalUrl(item.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-xs"
                            >
                              <span>Renew</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          )}
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
