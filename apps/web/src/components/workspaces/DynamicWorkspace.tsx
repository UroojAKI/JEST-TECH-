'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import {
  TrendingUp, TrendingDown, Minus,
  Users, FileText, Shield, DollarSign,
  RefreshCw, AlertTriangle, BarChart3,
  Clock, CheckCircle, Phone, Target, Activity
} from 'lucide-react';

interface DynamicWorkspaceProps {
  roleLabel: string;
  roleIcon?: React.ReactNode;
  fallbackRole?: string;
  customContent?: React.ReactNode;
}

function KpiCard({ title, value, subtitle, trend, trendValue, color = 'primary' }: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;
  color?: 'primary' | 'emerald' | 'amber' | 'rose' | 'sky' | 'violet';
}) {
  const colorMap: Record<string, string> = {
    primary: 'text-primary bg-primary/10',
    emerald: 'text-emerald-600 bg-emerald-500/10',
    amber: 'text-amber-600 bg-amber-500/10',
    rose: 'text-rose-600 bg-rose-500/10',
    sky: 'text-sky-600 bg-sky-500/10',
    violet: 'text-violet-600 bg-violet-500/10',
  };
  const valueColorMap: Record<string, string> = {
    primary: 'text-primary',
    emerald: 'text-emerald-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    sky: 'text-sky-600',
    violet: 'text-violet-600',
  };

  return (
    <div className="p-4 rounded-2xl border bg-card text-card-foreground shadow-xs hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{title}</div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[10px] font-bold ${
            trend === 'up' ? 'text-emerald-600' : trend === 'down' ? 'text-rose-600' : 'text-muted-foreground'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : trend === 'down' ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`text-2xl font-black mt-2 tracking-tight ${valueColorMap[color]}`}>
        {value}
      </div>
      {subtitle && <div className="text-[10px] text-muted-foreground mt-1 font-medium">{subtitle}</div>}
    </div>
  );
}

export function DynamicWorkspace({ roleLabel, roleIcon, fallbackRole, customContent }: DynamicWorkspaceProps) {
  const { data: dashboard, isLoading: dashLoading, isError: dashError, refetch } = useQuery({
    queryKey: ['dashboard-dynamic', roleLabel],
    queryFn: async () => {
      const simulatedRole = fallbackRole || roleLabel.toUpperCase().replace(/ DASHBOARD| HUB/g, '').replace(/ /g, '_');
      const res = await apiClient.get('/dashboard', { params: { role: simulatedRole } });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: leads = [] } = useQuery({
    queryKey: ['workspace-recent-leads'],
    queryFn: async () => {
      const res = await apiClient.get('/leads', { params: { limit: 5, sortBy: 'createdAt', sortOrder: 'desc' } });
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 60 * 1000,
  });

  const { data: policies = [] } = useQuery({
    queryKey: ['workspace-recent-policies'],
    queryFn: async () => {
      const res = await apiClient.get('/policies', { params: { limit: 5, sortBy: 'createdAt', sortOrder: 'desc' } });
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 60 * 1000,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {roleIcon && (
            <div className="h-12 w-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              {roleIcon}
            </div>
          )}
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">JestPolizy CRM</div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">{roleLabel}</h1>
            <p className="text-xs text-muted-foreground mt-1">Live dashboard • Data updates every 2 minutes</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border bg-card text-xs font-bold hover:bg-accent transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      {dashLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="p-4 rounded-2xl border bg-card animate-pulse h-24" />
          ))}
        </div>
      ) : dashError ? (
        <div className="p-6 rounded-2xl border border-rose-500/20 bg-rose-500/5 flex items-center gap-3 text-rose-600">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <div className="font-bold text-sm">Dashboard metrics unavailable</div>
            <div className="text-xs text-muted-foreground mt-0.5">Could not connect to the analytics service. Please check the API server is running.</div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dashboard?.kpis && Object.keys(dashboard.kpis).length > 0 ? (
            Object.entries(dashboard.kpis).map(([key, value]) => {
              const title = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
              return (
                <KpiCard
                  key={key}
                  title={title}
                  value={String(value)}
                  color="primary"
                />
              );
            })
          ) : (
            // Fallback if backend doesn't return structured KPIs yet
            <>
              <KpiCard title="Dashboard" value="Live" subtitle="Connected to API" color="emerald" />
              <KpiCard title="Status" value="Active" subtitle="System online" color="primary" />
            </>
          )}
        </div>
      )}

      {/* Custom role-specific content */}
      {customContent}

      {/* Two-column layout: Recent Leads + Recent Policies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Leads */}
        <div className="p-4 rounded-2xl border bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-black text-foreground">Recent Leads</h3>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">{Array.isArray(leads) ? leads.length : 0} shown</span>
          </div>
          <div className="space-y-2">
            {Array.isArray(leads) && leads.length > 0 ? leads.slice(0, 5).map((lead: any) => (
              <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                <div>
                  <div className="font-bold text-foreground">
                    {lead.contact?.firstName || ''} {lead.contact?.lastName || lead.title || 'Lead'}
                  </div>
                  <div className="text-muted-foreground font-mono text-[10px]">{lead.leadCode}</div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                  lead.status === 'CONVERTED' ? 'bg-emerald-500/10 text-emerald-600' :
                  lead.status === 'LOST' ? 'bg-rose-500/10 text-rose-600' :
                  'bg-amber-500/10 text-amber-600'
                }`}>{lead.status || 'ACTIVE'}</span>
              </div>
            )) : (
              <div className="text-center py-6 text-xs text-muted-foreground">No recent leads</div>
            )}
          </div>
        </div>

        {/* Recent Policies */}
        <div className="p-4 rounded-2xl border bg-card shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-black text-foreground">Recent Policies</h3>
            </div>
            <span className="text-[10px] font-bold text-muted-foreground">{Array.isArray(policies) ? policies.length : 0} shown</span>
          </div>
          <div className="space-y-2">
            {Array.isArray(policies) && policies.length > 0 ? policies.slice(0, 5).map((policy: any) => (
              <div key={policy.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors text-xs">
                <div>
                  <div className="font-bold text-foreground font-mono">{policy.policyNumber}</div>
                  <div className="text-muted-foreground text-[10px]">{policy.insurerName || 'Insurance Co.'}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-primary">₹{Number(policy.totalPremium || 0).toLocaleString('en-IN')}</div>
                  <div className="text-muted-foreground text-[10px]">{policy.status}</div>
                </div>
              </div>
            )) : (
              <div className="text-center py-6 text-xs text-muted-foreground">No recent policies</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
