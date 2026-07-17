'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import KpiCard from '@/components/dashboard/kpi-card';
import ChartCard from '@/components/dashboard/chart-card';
import NotificationCard from '@/components/dashboard/notification-card';
import RenewalCard from '@/components/dashboard/renewal-card';
import QuickActionCard from '@/components/dashboard/quick-action-card';
import DocumentsTab from '@/components/dashboard/documents-tab';

import {
  Users,
  Activity,
  ShieldCheck,
  Percent,
  Sparkles,
  FileText,
  AlertOctagon,
  CalendarDays,
  DollarSign,
  Database,
  Zap,
  History,
  FileCheck,
  FolderOpen,
} from 'lucide-react';

const kpiMeta: Record<string, { label: string; icon: any; color: string }> = {
  todayLeads: { label: "Today's Leads", icon: Sparkles, color: 'text-indigo-500' },
  openLeads: { label: 'Open Leads', icon: Sparkles, color: 'text-indigo-400' },
  pendingQuotes: { label: 'Pending Quotes', icon: FileText, color: 'text-amber-500' },
  policiesIssued: { label: 'Policies Issued', icon: ShieldCheck, color: 'text-emerald-500' },
  claimsAssigned: { label: 'Claims Assigned', icon: AlertOctagon, color: 'text-rose-500' },
  renewalsAlerts: { label: 'Renewals Alerts', icon: CalendarDays, color: 'text-violet-500' },
  todayRevenue: { label: "Today's Revenue", icon: DollarSign, color: 'text-teal-500' },
  achievement: { label: 'Achievement Rate', icon: Percent, color: 'text-indigo-600' },
  apiHealth: { label: 'API Uptime', icon: Activity, color: 'text-emerald-500' },
  dbStatus: { label: 'Database Health', icon: Database, color: 'text-indigo-500' },
  dbPing: { label: 'Database Latency', icon: Activity, color: 'text-cyan-500' },
  redisStatus: { label: 'Redis Health', icon: Zap, color: 'text-amber-500' },
  activeSessions: { label: 'Active User Sessions', icon: Users, color: 'text-violet-500' },
  systemUsers: { label: 'Platform Users Count', icon: Users, color: 'text-indigo-400' },
  auditEvents: { label: 'Recorded Audit Events', icon: History, color: 'text-emerald-600' },
  revenue: { label: 'Monthly Revenue Sum', icon: DollarSign, color: 'text-teal-500' },
  policiesCount: { label: 'Policies Count', icon: ShieldCheck, color: 'text-indigo-500' },
  claimsCount: { label: 'Claims Count', icon: AlertOctagon, color: 'text-rose-500' },
  lossRatio: { label: 'Loss Ratio Sum', icon: Percent, color: 'text-rose-400' },
  renewalRate: { label: 'Renewal Performance', icon: Percent, color: 'text-indigo-600' },
  branchRevenue: { label: 'Branch Revenue Sum', icon: DollarSign, color: 'text-teal-500' },
  conversionRate: { label: 'Conversion Rate', icon: Percent, color: 'text-emerald-500' },
  pendingApprovals: { label: 'Pending Approvals', icon: FileCheck, color: 'text-amber-500' },
  branchClaims: { label: 'Branch Claims Pending', icon: AlertOctagon, color: 'text-rose-500' },
};

export default function DashboardPage() {
  const [entityType, setEntityType] = useState('POLICY');
  const [entityId, setEntityId] = useState('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const res = await api.get('/dashboard');
      return res.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
        <p className="text-sm text-slate-400">Loading your personalized dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass rounded-xl p-8 max-w-lg mx-auto text-center border-rose-500/20">
        <h2 className="text-xl font-bold text-rose-400 mb-2">Error Loading Dashboard</h2>
        <p className="text-sm text-slate-400 mb-6">
          Could not fetch metrics from the live backend server. Make sure the API is running.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Helper to resolve formatted text
  const formatValue = (key: string, value: any) => {
    if (key.toLowerCase().includes('revenue') || key === 'amount') {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(Number(value));
    }
    if (key === 'achievement' || key === 'achievementRate') {
      return `${value}%`;
    }
    return String(value);
  };

  // Extract layout grid components
  const kpiIds = data?.layout
    ?.filter((item: any) => item.id !== 'funnelChart' && item.id !== 'topInsurersChart')
    ?.map((item: any) => item.id) || [];

  return (
    <div className="space-y-8">
      {/* Page Welcome Title */}
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">
          Live Workspace Overview
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Role-specific dashboard backed by active database metrics.
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {kpiIds.map((id: string) => {
          const meta = kpiMeta[id] || { label: id, icon: Activity, color: 'text-indigo-500' };
          const rawValue = data?.kpis?.[id] ?? '0';
          const displayVal = formatValue(id, rawValue);
          return (
            <KpiCard
              key={id}
              label={meta.label}
              value={displayVal}
              change="+1.2% vs yesterday"
              icon={meta.icon}
              color={meta.color}
            />
          );
        })}
      </div>

      {/* Graphs & Widgets */}
      <div className="grid gap-6 md:grid-cols-3">
        {data?.charts?.funnel && (
          <div className="md:col-span-2">
            <ChartCard title="Lead Funnel Pipeline" data={data.charts.funnel} />
          </div>
        )}

        {data?.widgets?.renewals && (
          <div>
            <RenewalCard renewals={data.widgets.renewals} />
          </div>
        )}

        {data?.widgets?.activities && (
          <div className="md:col-span-2">
            <NotificationCard title="Recent Activity Logs" activities={data.widgets.activities} />
          </div>
        )}

        {data?.quickActions && (
          <div className="md:col-span-3">
            <QuickActionCard actions={data.quickActions} />
          </div>
        )}
      </div>

      {/* Dynamic Documents Vault Tab */}
      <div className="glass rounded-xl p-6 border border-slate-900 mt-8">
        <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-indigo-400" /> Active Entity Documents Vault
        </h2>
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 max-w-xs">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Entity Type</label>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full rounded-lg bg-slate-900/60 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
            >
              <option value="POLICY">Policy</option>
              <option value="CLAIM">Claim</option>
              <option value="LEAD">Lead</option>
              <option value="CONTACT">Contact</option>
            </select>
          </div>
          <div className="flex-1 max-w-xs">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Entity ID or Code</label>
            <input
              type="text"
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              placeholder="e.g. claim or policy UUID..."
              className="w-full rounded-lg bg-slate-900/60 py-2 px-3 text-xs text-white placeholder-slate-600 border border-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {entityId ? (
          <DocumentsTab entityType={entityType} entityId={entityId} />
        ) : (
          <p className="text-xs text-slate-500 text-center py-6 border border-dashed border-slate-900 rounded-xl">
            Enter an Entity ID above (e.g., policy or claim UUID) to open its document manager tab.
          </p>
        )}
      </div>
    </div>
  );
}
