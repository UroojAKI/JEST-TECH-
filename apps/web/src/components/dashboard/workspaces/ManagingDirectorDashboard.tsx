'use client';
import React from 'react';
import { TrendingUp, Users, FileText, Wallet, AlertCircle, Building2, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

export default function ManagingDirectorDashboard() {
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['md-dashboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const { data: branches = [], isLoading: isBranchesLoading } = useQuery({
    queryKey: ['md-branch-gwp'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard/management/branch-gwp');
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const kpis = dashboard?.kpis || {};
  const revenue = kpis.revenue || kpis.todayRevenue || 0;
  const policiesCount = kpis.policiesCount || kpis.policiesIssued || 0;
  const lossRatio = kpis.lossRatio || '0.0%';
  const renewalRate = kpis.renewalRate || '0.0%';

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Premium Written */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Premium Written (MTD)</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">₹{revenue.toLocaleString('en-IN')}</div>
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
          <div className="text-2xl font-black">{policiesCount}</div>
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
          <div className="text-2xl font-black">{renewalRate}</div>
          <div className="text-xs text-muted-foreground font-semibold">
            Live policy renewals conversion
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branch-wise Performance Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Regional Branch Performance
          </h3>
          {isBranchesLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading branch GWP...
            </div>
          ) : branches.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-accent/20">
              No branch performance records found in database.
            </div>
          ) : (
            <div className="space-y-3">
              {branches.map((b: any, i: number) => (
                <div key={b.branchId || i} className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30">
                  <div>
                    <span className="text-sm font-semibold">{b.branchName}</span>
                    <span className="text-[10px] text-muted-foreground font-mono ml-2">({b.branchCode})</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{b.formattedGwp || `₹${(b.gwp || 0).toLocaleString('en-IN')}`}</div>
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
            <div className="text-2xl font-black text-rose-500">{lossRatio}</div>
            <div className="text-xs text-muted-foreground mt-1">Computed from settled claims vs premium payments</div>
          </div>

          {/* Active System Claims */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Active Claims Count</span>
              <FileText className="h-4 w-4 text-amber-500" />
            </div>
            <div className="text-2xl font-black text-foreground">{kpis.claimsCount || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Total claims registered in system</div>
          </div>
        </div>
      </div>
    </div>
  );
}
