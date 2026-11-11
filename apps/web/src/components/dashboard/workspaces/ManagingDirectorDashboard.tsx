'use client';

import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  FileText,
  Wallet,
  AlertCircle,
  Building2,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Download,
  CheckCircle2,
  ShieldAlert,
  DollarSign,
  Layers,
  ArrowRight,
  Clock,
  Briefcase,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiClient, getApiErrorMessage } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/auth-store';
import { biRepository } from '../../../repositories/bi.repository';

export default function ManagingDirectorDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'funnel' | 'action-centre' | 'commissions'>('overview');
  const [exportingType, setExportingType] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const canFetch = hasHydrated && isAuthenticated && !!user?.id;

  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['admin-executive-dashboard'],
    enabled: canFetch,
    queryFn: async () => {
      const res = await apiClient.get('/dashboard');
      return res.data;
    },
  });

  const {
    data: branches = [],
    isLoading: isBranchesLoading,
    isError: isBranchesError,
    error: branchesError,
    refetch: refetchBranches,
  } = useQuery({
    queryKey: ['admin-branch-gwp'],
    enabled: canFetch,
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/management/branch-gwp');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // Workstream 3: Sales Funnel & Conversion Intelligence
  const { data: conversion, isLoading: isConversionLoading } = useQuery({
    queryKey: ['bi-conversion'],
    enabled: canFetch,
    queryFn: () => biRepository.getConversion(),
  });

  // Workstream 3: Agent Performance Analytics
  const { data: agentPerformance, isLoading: isAgentPerfLoading } = useQuery({
    queryKey: ['bi-agent-performance'],
    enabled: canFetch,
    queryFn: () => biRepository.getAgentPerformance(),
  });

  // Workstream 3: Operational Action Centre
  const { data: actionCentre, isLoading: isActionCentreLoading, isError: isActionCentreError, error: actionCentreError, refetch: refetchActionCentre } = useQuery({
    queryKey: ['bi-operational-action-centre'],
    enabled: canFetch,
    queryFn: () => biRepository.getOperationalActionCentre(),
  });

  // Workstream 3: Commission Intelligence
  const { data: commissions, isLoading: isCommissionsLoading } = useQuery({
    queryKey: ['bi-commission-intelligence'],
    enabled: canFetch,
    queryFn: () => biRepository.getCommissionIntelligence(),
  });

  const handleExport = async (type: 'agent-performance' | 'commission-intelligence' | 'action-centre' | 'revenue') => {
    try {
      setExportingType(type);
      const blob = await biRepository.exportReport(type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bi-${type}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`${type.replace('-', ' ')} exported to CSV`);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err) || `Failed to export ${type}`);
    } finally {
      setExportingType(null);
    }
  };

  const kpis = dashboard?.kpis || {};
  const revenue = kpis.revenue || kpis.todayRevenue || 0;
  const policiesCount = kpis.policiesCount || kpis.policiesIssued || 0;
  const lossRatio = kpis.lossRatio || '0.0%';
  const renewalRate = kpis.renewalRate || '0.0%';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Executive Business Intelligence &amp; Performance
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time Gross Written Premium (GWP), agent productivity, sales conversion funnel &amp; operational action centre
          </p>
        </div>

        {/* Action Centre Badges & Export */}
        <div className="flex items-center gap-2 flex-wrap">
          {actionCentre && actionCentre.summary.totalActionItems > 0 && (
            <span
              onClick={() => setActiveTab('action-centre')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-300 text-rose-700 text-xs font-bold cursor-pointer hover:bg-rose-500/20 transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-rose-600 animate-pulse" />
              {actionCentre.summary.totalActionItems} Action Items
            </span>
          )}

          <button
            onClick={() => handleExport(activeTab === 'commissions' ? 'commission-intelligence' : activeTab === 'action-centre' ? 'action-centre' : 'agent-performance')}
            disabled={!!exportingType}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border bg-card hover:bg-accent text-xs font-semibold shadow-xs disabled:opacity-50"
          >
            {exportingType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
            Export CSV
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b text-xs font-medium gap-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview & Branches', icon: Layers },
          { id: 'funnel', label: 'Sales Funnel', icon: TrendingUp },
          { id: 'action-centre', label: `Action Centre (${actionCentre?.summary.totalActionItems || 0})`, icon: ShieldAlert },
          { id: 'commissions', label: 'Commission Intelligence', icon: DollarSign },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap font-semibold ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error state for top KPIs */}
      {isDashboardError && (
        <div className="p-4 border border-destructive/20 bg-destructive/10 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-destructive font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Failed to load executive KPI metrics: {getApiErrorMessage(dashboardError)}</span>
          </div>
          <button
            onClick={() => refetchDashboard()}
            className="px-2.5 py-1 text-xs bg-destructive text-destructive-foreground rounded font-bold hover:bg-destructive/90 flex items-center gap-1"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Top 3 High-Level KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Premium Written */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Premium Written (MTD)</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">
            {isDashboardLoading ? (
              <span className="text-muted-foreground text-base font-normal">Loading...</span>
            ) : isDashboardError ? (
              <span className="text-destructive text-base font-normal">Error</span>
            ) : (
              `₹${revenue.toLocaleString('en-IN')}`
            )}
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Live database gross written premium
          </div>
        </div>

        {/* Policies Issued */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Policies Issued</span>
            <FileText className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">
            {isDashboardLoading ? (
              <span className="text-muted-foreground text-base font-normal">Loading...</span>
            ) : isDashboardError ? (
              <span className="text-destructive text-base font-normal">Error</span>
            ) : (
              policiesCount
            )}
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Authoritative policies active/issued
          </div>
        </div>

        {/* Renewal Retention Rate */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Renewal Retention Rate</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">
            {isDashboardLoading ? (
              <span className="text-muted-foreground text-base font-normal">Loading...</span>
            ) : isDashboardError ? (
              <span className="text-destructive text-base font-normal">Error</span>
            ) : (
              renewalRate
            )}
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Live policy renewals conversion
          </div>
        </div>

        {/* Active Agents Producing */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Active Agents</span>
            <Briefcase className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600">
            {isAgentPerfLoading ? '…' : agentPerformance?.activeAgents ?? 0}
            <span className="text-xs text-muted-foreground font-normal font-sans ml-1.5">
              / {agentPerformance?.totalAgents ?? 0} total
            </span>
          </div>
          <div className="text-xs text-muted-foreground font-semibold">
            Avg Conversion: {agentPerformance?.averageConversionRate ?? 0}%
          </div>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & BRANCHES */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Branch-wise Performance Table */}
            <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Regional Branch Performance
                </h3>
                {isBranchesError && (
                  <button
                    onClick={() => refetchBranches()}
                    className="text-xs text-destructive font-semibold hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="h-3 w-3" /> Retry
                  </button>
                )}
              </div>

              {isBranchesLoading ? (
                <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading branch GWP...
                </div>
              ) : isBranchesError ? (
                <div className="p-6 text-center text-xs text-destructive border border-destructive/20 bg-destructive/10 rounded-xl space-y-2">
                  <AlertTriangle className="h-5 w-5 mx-auto" />
                  <p>Failed to load branch performance: {getApiErrorMessage(branchesError)}</p>
                </div>
              ) : branches.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-accent/20">
                  No branch performance records found in database.
                </div>
              ) : (
                <div className="space-y-3">
                  {branches.map((b: any, i: number) => {
                    const isUnavailable = b.gwp === null || b.gwp === undefined || b.hasData === false;
                    const isZero = !isUnavailable && (b.gwp === 0 || b.policyCount === 0);

                    return (
                      <div
                        key={b.branchId || i}
                        className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30"
                      >
                        <div>
                          <span className="text-sm font-semibold">{b.branchName}</span>
                          <span className="text-[10px] text-muted-foreground font-mono ml-2">({b.branchCode})</span>
                          {b.policyCount !== undefined && b.hasData && (
                            <span className="text-[10px] text-muted-foreground ml-2">
                              · {b.policyCount} {b.policyCount === 1 ? 'policy' : 'policies'}
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          {isUnavailable ? (
                            <span className="text-xs text-amber-500 font-medium px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                              Data Unavailable
                            </span>
                          ) : isZero ? (
                            <div className="text-sm font-bold font-mono text-muted-foreground">
                              ₹0 <span className="text-[10px] font-normal">(No sales)</span>
                            </div>
                          ) : (
                            <div className="text-sm font-bold font-mono">
                              {b.formattedGwp || `₹${Number(b.gwp).toLocaleString('en-IN')}`}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Claims Ratio */}
              <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Loss Ratio (Claims Settled / GWP)</span>
                  <AlertCircle className="h-4 w-4" />
                </div>
                <div className="text-2xl font-black text-rose-500">
                  {isDashboardLoading ? '…' : lossRatio}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Computed from settled claims vs premium payments</div>
              </div>

              {/* Active System Claims */}
              <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
                <div className="flex items-center justify-between text-muted-foreground mb-2">
                  <span className="text-xs font-semibold">Active Claims Count</span>
                  <FileText className="h-4 w-4 text-amber-500" />
                </div>
                <div className="text-2xl font-black text-foreground">
                  {isDashboardLoading ? '…' : kpis.claimsCount || 0}
                </div>
                <div className="text-xs text-muted-foreground mt-1">Total claims registered in system</div>
              </div>
            </div>
          </div>

          {/* Top Agent Performers Leaderboard */}
          <div className="border rounded-2xl p-5 bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-primary" /> Top Performing Agents (Workstream 3)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Authoritative Gross Written Premium, conversion rates, and active policy retention
                </p>
              </div>
              <button
                onClick={() => handleExport('agent-performance')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Download className="h-3 w-3" /> Full Agent Roster
              </button>
            </div>

            {isAgentPerfLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground">Loading agent analytics...</div>
            ) : !agentPerformance || agentPerformance.topPerformers.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">No agent production records recorded.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                      <th className="p-3">Agent Code</th>
                      <th className="p-3">Agent Name</th>
                      <th className="p-3">Branch</th>
                      <th className="p-3">Gross Written Premium</th>
                      <th className="p-3">Issued Policies</th>
                      <th className="p-3">Active vs Lapsed</th>
                      <th className="p-3">Leads Conversion</th>
                      <th className="p-3">Commission Earned</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono">
                    {agentPerformance.topPerformers.map((agent) => (
                      <tr key={agent.agentId} className="hover:bg-accent/40 font-sans">
                        <td className="p-3 font-mono font-bold text-primary">{agent.agentCode}</td>
                        <td className="p-3 font-semibold">{agent.agentName}</td>
                        <td className="p-3 text-muted-foreground">{agent.branchName || '-'}</td>
                        <td className="p-3 font-mono font-bold text-emerald-600">{agent.formattedGwp}</td>
                        <td className="p-3 font-mono">{agent.policiesIssued}</td>
                        <td className="p-3 font-mono">
                          <span className="text-emerald-600 font-bold">{agent.activePolicies}</span>
                          <span className="text-muted-foreground"> / </span>
                          <span className="text-rose-500">{agent.lapsedPolicies}</span>
                          <span className="text-[10px] text-muted-foreground ml-1 font-sans">({agent.activeVsLapsedRatio}%)</span>
                        </td>
                        <td className="p-3 font-mono">
                          {agent.leadsConverted}/{agent.leadsAssigned}
                          <span className="text-[10px] text-emerald-600 font-bold ml-1 font-sans">({agent.conversionRate}%)</span>
                        </td>
                        <td className="p-3 font-mono text-indigo-600 font-semibold">
                          ₹{agent.commissionEarned.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SALES CONVERSION FUNNEL */}
      {activeTab === 'funnel' && (
        <div className="border rounded-2xl p-6 bg-card shadow-xs space-y-6">
          <div className="space-y-1">
            <h3 className="text-base font-bold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> End-to-End Sales Conversion Funnel
            </h3>
            <p className="text-xs text-muted-foreground">
              Lifecycle progression: Lead Attribution → Quotation Shared → Proposal Submitted → Payment Reconciled → Policy Issued
            </p>
          </div>

          {isConversionLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading sales funnel metrics...</div>
          ) : !conversion ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No funnel data available.</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {conversion.funnelJourney.map((step, idx) => (
                  <div key={step.stage} className="p-4 rounded-xl border bg-muted/20 space-y-2 relative">
                    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                      <span>Step {idx + 1}</span>
                      {idx > 0 && <span className="text-emerald-600 font-mono font-bold">{step.conversionRate}%</span>}
                    </div>
                    <div className="text-sm font-bold capitalize">{step.stage.replace('_', ' ').toLowerCase()}</div>
                    <div className="text-2xl font-black font-mono text-primary">{step.count.toLocaleString('en-IN')}</div>
                    {idx < conversion.funnelJourney.length - 1 && (
                      <div className="hidden sm:block absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Conversion Metrics Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t">
                <div className="p-3 bg-muted/40 rounded-xl">
                  <div className="text-[11px] text-muted-foreground font-medium">Lead to Quote Rate</div>
                  <div className="text-lg font-bold font-mono mt-0.5 text-primary">{conversion.leadToQuoteRate}%</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <div className="text-[11px] text-muted-foreground font-medium">Quote to Proposal Rate</div>
                  <div className="text-lg font-bold font-mono mt-0.5 text-indigo-600">{conversion.quoteToProposalRate}%</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <div className="text-[11px] text-muted-foreground font-medium">Proposal to Payment Rate</div>
                  <div className="text-lg font-bold font-mono mt-0.5 text-emerald-600">{conversion.proposalToPaymentRate}%</div>
                </div>
                <div className="p-3 bg-muted/40 rounded-xl">
                  <div className="text-[11px] text-muted-foreground font-medium">Overall Conversion Rate</div>
                  <div className="text-lg font-bold font-mono mt-0.5 text-emerald-600">{conversion.overallConversionRate}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: OPERATIONAL ACTION CENTRE */}
      {activeTab === 'action-centre' && (
        <div className="space-y-6">
          {isActionCentreLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading operational action centre...</div>
          ) : isActionCentreError ? (
            <div className="p-6 border border-destructive/30 rounded-xl flex items-center justify-between"><span className="text-xs text-destructive">{getApiErrorMessage(actionCentreError) || 'Failed to load operational queues.'}</span><button onClick={() => refetchActionCentre()} className="px-3 py-1.5 rounded border text-xs font-semibold">Retry</button></div>
          ) : !actionCentre ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No operational action items pending.</div>
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-rose-600 font-semibold flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Overdue Tasks
                  </div>
                  <div className="text-2xl font-black font-mono text-rose-600">
                    {actionCentre.summary.overdueTasksCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-amber-600 font-semibold flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5" /> Pending Inspections
                  </div>
                  <div className="text-2xl font-black font-mono text-amber-600">
                    {actionCentre.summary.pendingInspectionsCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-indigo-600 font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Payment Verifications
                  </div>
                  <div className="text-2xl font-black font-mono text-indigo-600">
                    {actionCentre.summary.pendingPaymentsCount}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-purple-600 font-semibold flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" /> Compliance Holds
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-600">
                    {actionCentre.summary.complianceBlocksCount}
                  </div>
                </div>
              </div>

              {/* Action Items Register */}
              <div className="border rounded-2xl overflow-hidden bg-card shadow-xs space-y-0">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-rose-600" /> Critical Operational Action Queue
                  </h3>
                  <button
                    onClick={() => handleExport('action-centre')}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Export Action Items
                  </button>
                </div>

                {actionCentre.summary.totalActionItems === 0 ? (
                  <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                    <span className="font-semibold text-foreground">All Clear! No Pending Action Items.</span>
                    <span>All customer verifications, vehicle inspections, and payment reconciliations are up to date.</span>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                          <th className="p-3">Severity</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Title / Subject</th>
                          <th className="p-3">Reference Code</th>
                          <th className="p-3">Assigned To</th>
                          <th className="p-3">Due / Aging</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {[
                          ...actionCentre.itemsByCategory.overdueTasks,
                          ...actionCentre.itemsByCategory.backOfficeTasks,
                          ...actionCentre.itemsByCategory.pendingInspections,
                          ...actionCentre.itemsByCategory.pendingPayments,
                          ...actionCentre.itemsByCategory.complianceBlocks,
                        ].map((item) => (
                          <tr key={item.id} className="hover:bg-accent/40 font-sans">
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.severity === 'CRITICAL'
                                  ? 'bg-rose-500/10 text-rose-700 border border-rose-300'
                                  : 'bg-amber-500/10 text-amber-700 border border-amber-300'
                              }`}>
                                {item.severity}
                              </span>
                            </td>
                            <td className="p-3 font-mono text-[11px] text-muted-foreground">
                              {item.category.replace('_', ' ')}
                            </td>
                            <td className="p-3 font-semibold text-foreground">
                              <div>{item.title}</div>
                              {item.entityType === 'Proposal' && <a className="text-primary text-[11px] hover:underline" href={`/sales/proposals/${item.entityId}`}>Open proposal</a>}
                              {item.entityType === 'MotorQuotation' && <a className="text-primary text-[11px] hover:underline" href={`/workspace/operations/inspections/${item.entityId}`}>Open inspection</a>}
                              {item.entityType === 'BackOfficeTask' && <a className="text-primary text-[11px] hover:underline" href="/workspace/operations/issuance">Open issuance queue</a>}
                            </td>
                            <td className="p-3 font-mono font-bold text-primary">{item.referenceCode || '-'}</td>
                            <td className="p-3 text-muted-foreground">{item.assignedTo || 'Unassigned'}</td>
                            <td className="p-3 font-mono text-rose-600 font-semibold">
                              {item.daysOverdue ? `${item.daysOverdue}d overdue` : new Date(item.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: COMMISSION INTELLIGENCE */}
      {activeTab === 'commissions' && (
        <div className="space-y-6">
          {isCommissionsLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground">Loading commission intelligence...</div>
          ) : !commissions ? (
            <div className="p-8 text-center text-xs text-muted-foreground">No commission records available.</div>
          ) : (
            <div className="space-y-6">
              {/* High Level Reconciliation Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">Total Earned Commission</div>
                  <div className="text-2xl font-black font-mono text-primary">
                    ₹{commissions.totalEarned.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-emerald-600 font-semibold">Disbursed / Paid</div>
                  <div className="text-2xl font-black font-mono text-emerald-600">
                    ₹{commissions.totalPaid.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-amber-600 font-semibold">Pending Reconciliation</div>
                  <div className="text-2xl font-black font-mono text-amber-600">
                    ₹{commissions.totalPending.toLocaleString('en-IN')}
                  </div>
                </div>
                <div className="p-4 rounded-xl border bg-card space-y-1">
                  <div className="text-xs text-muted-foreground font-semibold">Reconciliation Rate</div>
                  <div className="text-2xl font-black font-mono text-indigo-600">
                    {commissions.reconciliationRate}%
                  </div>
                </div>
              </div>

              {/* Commission Ledger by Agent */}
              <div className="border rounded-2xl overflow-hidden bg-card shadow-xs space-y-0">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-emerald-600" /> Agent Commission Reconciliation Ledger
                  </h3>
                  <button
                    onClick={() => handleExport('commission-intelligence')}
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    <Download className="h-3 w-3" /> Export Ledger CSV
                  </button>
                </div>

                {commissions.byAgent.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">No agent commissions accrued.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                          <th className="p-3">Agent Code</th>
                          <th className="p-3">Agent Name</th>
                          <th className="p-3">Commission Records</th>
                          <th className="p-3">Total Earned</th>
                          <th className="p-3">Paid / Settled</th>
                          <th className="p-3">Pending Payment</th>
                          <th className="p-3">Payout Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {commissions.byAgent.map((agent) => {
                          const isFullySettled = agent.totalPending === 0 && agent.totalEarned > 0;
                          return (
                            <tr key={agent.agentId} className="hover:bg-accent/40 font-sans">
                              <td className="p-3 font-mono font-bold text-primary">{agent.agentCode}</td>
                              <td className="p-3 font-semibold">{agent.agentName}</td>
                              <td className="p-3 font-mono">{agent.recordsCount}</td>
                              <td className="p-3 font-mono font-bold">₹{agent.totalEarned.toLocaleString('en-IN')}</td>
                              <td className="p-3 font-mono text-emerald-600 font-semibold">₹{agent.totalPaid.toLocaleString('en-IN')}</td>
                              <td className="p-3 font-mono text-amber-600 font-semibold">₹{agent.totalPending.toLocaleString('en-IN')}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isFullySettled
                                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300'
                                    : 'bg-amber-500/10 text-amber-700 border border-amber-300'
                                }`}>
                                  {isFullySettled ? 'FULLY SETTLED' : 'PENDING SETTLEMENT'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
