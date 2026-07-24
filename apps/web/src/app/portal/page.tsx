'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import {
  UserCheck,
  Plus,
  Zap,
  TrendingUp,
  Award,
  FileText,
  Clock,
  DollarSign,
  ShieldCheck,
  ArrowRight,
  Download,
  Users,
  Building2,
} from 'lucide-react';
import { useAgentDashboard } from '../../hooks/usePortal';

export default function AgentPortalDashboardPage() {
  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <span className="font-mono font-bold text-[10px] text-primary uppercase">POSP Partner & Agent Portal</span>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary" /> Rajesh Sharma (Agent Code: AGT-8812)
          </h1>
          <p className="text-xs text-muted-foreground">Mumbai BKC Flagship Branch • Senior Sales Partner • POSP Certified</p>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/portal/quotations"
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Zap className="h-4 w-4" />
            <span>+ Get Instant Quote</span>
          </a>
        </div>
      </div>

      {/* Sub-workspace Navigation Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
        {[
          { label: 'My Customers', path: '/portal/customers' },
          { label: 'My Leads', path: '/portal/leads' },
          { label: 'Quotations', path: '/portal/quotations' },
          { label: 'Proposals', path: '/portal/proposals' },
          { label: 'My Policies', path: '/portal/policies' },
          { label: 'Renewal Cockpit', path: '/portal/renewals' },
          { label: 'Claims Track', path: '/portal/claims' },
          { label: 'Commissions', path: '/portal/commissions' },
          { label: 'Performance', path: '/portal/performance' },
          { label: 'Downloads', path: '/portal/downloads' },
          { label: 'Support Desk', path: '/portal/support' },
          { label: 'Branch Team', path: '/portal/branch-manager' },
        ].map((item, idx) => (
          <a
            key={idx}
            href={item.path}
            className="p-2.5 rounded-lg border bg-card hover:border-primary hover:bg-primary/5 text-center font-bold text-foreground transition-colors shadow-sm"
          >
            {item.label}
          </a>
        ))}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Today's Leads</span>
          <div className="text-xl font-black text-primary">12 Active</div>
          <span className="text-[10px] text-emerald-600 font-semibold">+3 New Today</span>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Quotes</span>
          <div className="text-xl font-black text-amber-600">4 Drafts</div>
          <span className="text-[10px] text-muted-foreground">Follow-up due</span>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Policies Issued</span>
          <div className="text-xl font-black text-foreground">28 Month-to-Date</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Total GWP: ₹18.5L</span>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Renewals Due</span>
          <div className="text-xl font-black text-red-600">15 Policies</div>
          <span className="text-[10px] text-red-600 font-semibold">45-day window</span>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Commission Earned</span>
          <div className="text-xl font-black text-emerald-600">₹42,850</div>
          <span className="text-[10px] text-muted-foreground">Approved for payout</span>
        </div>

        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Target Progress</span>
          <div className="text-xl font-black text-emerald-600">84.2%</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Rank #3 in Branch</span>
        </div>
      </div>

      {/* Sales Target & Branch Leaderboard Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {/* Monthly Target Progress */}
        <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-foreground">Monthly Premium Target Achievement</h3>
            <span className="font-mono font-bold text-xs text-primary">₹18,50,000 / ₹22,00,000</span>
          </div>

          <div className="space-y-2">
            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              <div className="bg-primary h-3 rounded-full" style={{ width: '84%' }}></div>
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground font-semibold">
              <span>84.2% Completed</span>
              <span>₹3,50,000 Remaining to Target</span>
            </div>
          </div>
        </div>

        {/* Branch Leaderboard */}
        <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <Award className="h-4 w-4 text-amber-500" /> Mumbai BKC Branch Leaderboard
            </h3>
            <span className="text-[10px] font-bold text-muted-foreground">July 2026</span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { rank: 1, name: 'Sunil Verma', gwp: '₹28,40,000', badge: '🏆 Branch Top' },
              { rank: 2, name: 'Priya Nair', gwp: '₹22,15,000', badge: '🥈 Silver' },
              { rank: 3, name: 'Rajesh Sharma (You)', gwp: '₹18,50,000', badge: '🥉 Bronze' },
            ].map((agent) => (
              <div
                key={agent.rank}
                className={`p-2.5 rounded-xl border flex justify-between items-center font-bold ${
                  agent.rank === 3 ? 'bg-primary/10 border-primary text-primary' : 'bg-muted/10'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-black text-sm">#{agent.rank}</span>
                  <span>{agent.name}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-emerald-600">{agent.gwp}</span>
                  <span className="text-[10px] text-amber-600">{agent.badge}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
