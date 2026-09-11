'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import {
  UserCheck,
  Zap,
  Award,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useAgentDashboard } from '../../hooks/usePortal';
import { useAuthStore } from '../../store/auth-store';

export default function AgentPortalDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { data: metrics, isLoading } = useAgentDashboard();

  const userName = user
    ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
    : 'Authorized POSP Partner';

  const branchDisplay =
    metrics?.branchName ||
    (user as any)?.branch?.name ||
    'Registered Branch Network';

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <span className="font-mono font-bold text-[10px] text-primary uppercase">POSP Partner & Agent Portal</span>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> {userName}
          </h1>
          <p className="text-xs text-muted-foreground">{branchDisplay} • POSP Certified Partner</p>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            href="/sales/quotations"
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Zap className="h-4 w-4" />
            <span>+ Get Instant Quote</span>
          </Link>
        </div>
      </div>

      {/* Sub-workspace Navigation Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
        {[
          { label: 'My Customers', path: '/crm/contacts' },
          { label: 'My Leads', path: '/crm/leads' },
          { label: 'Quotations', path: '/sales/quotations' },
          { label: 'My Policies', path: '/policies' },
          { label: 'Renewal Cockpit', path: '/workspace/renewal' },
          { label: 'Claims Track', path: '/claims' },
          { label: 'Commissions', path: '/finance/commissions' },
          { label: 'Support Desk', path: '/portal/support' },
        ].map((item, idx) => (
          <Link
            key={idx}
            href={item.path}
            className="p-2.5 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 text-center font-bold text-foreground transition-colors shadow-xs"
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* KPI Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center p-8 bg-card border rounded-xl space-x-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading performance metrics...</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Today's Leads</span>
            <div className="text-xl font-black text-primary">{metrics?.todaysLeads ?? 0} Active</div>
            <span className="text-[10px] text-muted-foreground font-semibold">Active Inquiries</span>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Quotes</span>
            <div className="text-xl font-black text-amber-600">{metrics?.pendingQuotes ?? 0} Drafts</div>
            <span className="text-[10px] text-muted-foreground">Awaiting submission</span>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Policies Issued</span>
            <div className="text-xl font-black text-foreground">{metrics?.policiesIssued ?? 0} Total</div>
            <span className="text-[10px] text-emerald-600 font-semibold">Live in Force</span>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Renewals Due</span>
            <div className="text-xl font-black text-rose-600">{metrics?.renewalsDue ?? 0} Policies</div>
            <span className="text-[10px] text-muted-foreground font-semibold">Next 45 days</span>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Commission Earned</span>
            <div className="text-xl font-black text-emerald-600">
              ₹{(metrics?.commissionEarned ?? 0).toLocaleString('en-IN')}
            </div>
            <span className="text-[10px] text-muted-foreground">Verified Accruals</span>
          </div>

          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Progress</span>
            <div className="text-xl font-black text-emerald-600">
              {metrics?.monthlyTargetAchievementPercent ?? 0}%
            </div>
            <span className="text-[10px] text-muted-foreground font-semibold">Monthly Quota</span>
          </div>
        </div>
      )}

      {/* Sales Target & Branch Leaderboard Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Monthly Target Progress */}
        <div className="p-5 rounded-2xl border bg-card shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-foreground">Monthly Premium Target Achievement</h3>
            <span className="font-mono font-bold text-xs text-primary">
              {metrics?.monthlyTargetAchievementPercent ?? 0}% Achieved
            </span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(metrics?.monthlyTargetAchievementPercent ?? 0, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
              <span>Status: {metrics?.monthlyTargetAchievementPercent && metrics.monthlyTargetAchievementPercent >= 100 ? 'Quota Met' : 'In Progress'}</span>
              <span>Based on verified issued policies</span>
            </div>
          </div>
        </div>

        {/* Branch Leaderboard */}
        <div className="p-5 rounded-2xl border bg-card shadow-xs space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500" /> Branch Performance Ranking
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground font-mono">
              {branchDisplay}
            </span>
          </div>

          <div className="p-4 text-center rounded-xl bg-muted/10 border border-border/60 space-y-1">
            <div className="text-xs font-bold text-foreground">
              {metrics?.leaderboardRank ? `Your Branch Rank: #${metrics.leaderboardRank}` : 'Ranking in Progress'}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Branch leaderboard calculations update based on settled gross written premium (GWP).
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
