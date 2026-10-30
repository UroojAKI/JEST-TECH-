'use client';

import React from 'react';
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
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../../../lib/api-client';

export default function ManagingDirectorDashboard() {
  const {
    data: dashboard,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
    error: dashboardError,
    refetch: refetchDashboard,
  } = useQuery({
    queryKey: ['admin-executive-dashboard'],
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
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/management/branch-gwp');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const kpis = dashboard?.kpis || {};
  const revenue = kpis.revenue || kpis.todayRevenue || 0;
  const policiesCount = kpis.policiesCount || kpis.policiesIssued || 0;
  const lossRatio = kpis.lossRatio || '0.0%';
  const renewalRate = kpis.renewalRate || '0.0%';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Admin Executive Dashboard
          </h2>
          <p className="text-xs text-muted-foreground">
            Authoritative executive performance overview, Gross Written Premium (GWP), branch breakdown & loss ratios
          </p>
        </div>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
      </div>

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
              {branches.map((b: any, i: number) => (
                <div
                  key={b.branchId || i}
                  className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30"
                >
                  <div>
                    <span className="text-sm font-semibold">{b.branchName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">({b.branchCode})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold font-mono">
                      {b.formattedGwp || `₹${(b.gwp || 0).toLocaleString('en-IN')}`}
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
}
