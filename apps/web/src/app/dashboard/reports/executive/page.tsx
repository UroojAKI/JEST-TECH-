'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  TrendingUp,
  DollarSign,
  Shield,
  Award,
  PieChart,
  Users,
  Activity,
  ArrowUpRight,
  Building2,
  AlertCircle,
  FileCheck,
} from 'lucide-react';

export default function ExecutiveDashboardsPage() {
  const [roleMode, setRoleMode] = useState<'CEO' | 'SALES' | 'CLAIMS' | 'FINANCE'>('CEO');

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" /> Executive & Leadership BI Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">
            Role-tailored strategic analytics for CEO, Sales Leadership, Claims Directors, and Chief Financial Officers
          </p>
        </div>

        {/* Role Switcher */}
        <div className="flex items-center space-x-1 border rounded-lg p-1 bg-card text-xs">
          {[
            { id: 'CEO', label: 'CEO Dashboard' },
            { id: 'SALES', label: 'Sales Analytics' },
            { id: 'CLAIMS', label: 'Claims Cockpit' },
            { id: 'FINANCE', label: 'CFO & Finance' },
          ].map((role) => (
            <button
              key={role.id}
              onClick={() => setRoleMode(role.id as any)}
              className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                roleMode === role.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* CEO DASHBOARD */}
      {roleMode === 'CEO' && (
        <div className="space-y-6 text-xs">
          {/* Executive KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Total GWP (YTD)</span>
              <div className="text-lg font-black text-foreground">₹48.50 Cr</div>
              <span className="text-[10px] text-emerald-600 font-semibold flex items-center">
                <ArrowUpRight className="h-3 w-3 mr-0.5" /> +18.4% YoY
              </span>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Brokerage Revenue</span>
              <div className="text-lg font-black text-emerald-600">₹4.85 Cr</div>
              <span className="text-[10px] text-muted-foreground font-semibold">10% Margin</span>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Active Policies</span>
              <div className="text-lg font-black text-primary">12,480</div>
              <span className="text-[10px] text-muted-foreground font-semibold">92% Retention Rate</span>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Claims Loss Ratio</span>
              <div className="text-lg font-black text-amber-600">42.1%</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Within Target (&lt;50%)</span>
            </div>

            <div className="p-4 rounded-xl border bg-card space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Net EBITDA Margin</span>
              <div className="text-lg font-black text-emerald-600">28.5%</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Highest in Sector</span>
            </div>
          </div>

          {/* Branch & Insurer Performance Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Performing Branches */}
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-sm">Top Branch GWP Rankings</h3>
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="space-y-2">
                {[
                  { branch: 'Mumbai BKC Branch', gwp: '₹18.40 Cr', share: '38%' },
                  { branch: 'Pune Shivajinagar', gwp: '₹14.20 Cr', share: '29%' },
                  { branch: 'Bengaluru Indiranagar', gwp: '₹10.50 Cr', share: '22%' },
                  { branch: 'Delhi Connaught Place', gwp: '₹5.40 Cr', share: '11%' },
                ].map((b, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded border bg-muted/10">
                    <span className="font-bold">{b.branch}</span>
                    <div className="text-right">
                      <strong className="text-emerald-600 font-mono">{b.gwp}</strong>
                      <span className="text-muted-foreground ml-2 text-[10px]">({b.share})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Insurer Distribution Mix */}
            <div className="p-4 rounded-xl border bg-card space-y-3">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="font-bold text-sm">Partner Insurer Mix</h3>
                <PieChart className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="space-y-2">
                {[
                  { name: 'ICICI Lombard', gwp: '₹19.20 Cr', status: 'Primary Motor Partner' },
                  { name: 'HDFC ERGO', gwp: '₹15.80 Cr', status: 'Primary Corporate Health' },
                  { name: 'Star Health', gwp: '₹8.40 Cr', status: 'Retail Health Partner' },
                  { name: 'Bajaj Allianz', gwp: '₹5.10 Cr', status: 'Commercial Lines' },
                ].map((ins, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded border bg-muted/10">
                    <div>
                      <div className="font-bold">{ins.name}</div>
                      <span className="text-[10px] text-muted-foreground">{ins.status}</span>
                    </div>
                    <strong className="text-primary font-mono">{ins.gwp}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SALES DASHBOARD */}
      {roleMode === 'SALES' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-2">
            <h3 className="font-bold text-sm">Sales Funnel Conversion Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Leads Generated</span>
                <div className="text-lg font-black text-foreground">1,420</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Quotes Issued</span>
                <div className="text-lg font-black text-primary">890</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Proposals Underwritten</span>
                <div className="text-lg font-black text-amber-600">620</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Policies Converted</span>
                <div className="text-lg font-black text-emerald-600">480 (33.8%)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CLAIMS DASHBOARD */}
      {roleMode === 'CLAIMS' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-2">
            <h3 className="font-bold text-sm">Claims Turnaround & Exposure Metrics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Active Claims</span>
                <div className="text-lg font-black text-foreground">42</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Claim Exposure</span>
                <div className="text-lg font-black text-amber-600">₹68.50 L</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Avg Settlement Duration</span>
                <div className="text-lg font-black text-primary">4.2 Days</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Settlement Ratio</span>
                <div className="text-lg font-black text-emerald-600">97.8%</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FINANCE DASHBOARD */}
      {roleMode === 'FINANCE' && (
        <div className="space-y-4 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-2">
            <h3 className="font-bold text-sm">CFO Financial Cash Flow & Settlement Overview</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Collections Today</span>
                <div className="text-lg font-black text-emerald-600">₹2,48,500</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Commission Accrued</span>
                <div className="text-lg font-black text-primary">₹4,85,000</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Insurer Payables</span>
                <div className="text-lg font-black text-foreground">₹38,45,000</div>
              </div>
              <div className="p-3 rounded border bg-muted/10">
                <span className="text-[10px] text-muted-foreground uppercase font-bold">Receivables Recovered</span>
                <div className="text-lg font-black text-emerald-600">₹18,50,000</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
