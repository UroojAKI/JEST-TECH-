'use client';

import React, { useState } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  TrendingUp,
  ShieldAlert,
  Car,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/app-shell';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('LAST_30_DAYS');
  const [reportType, setReportType] = useState('ALL');

  const handleExport = (format: string) => {
    toast.success(`Exporting ${reportType} report as ${format.toUpperCase()}...`);
  };

  return (
    <AppShell>
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Operational & Performance Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time telemetry, issuance velocity, inspection turnaround, and financial reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card hover:bg-muted text-foreground text-xs font-semibold shadow-xs"
          >
            <Download className="h-4 w-4" />
            <span>Export CSV</span>
          </button>
          <button
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Generate Executive Summary</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border border-border bg-card">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground px-2">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
          className="text-xs rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
        >
          <option value="TODAY">Today</option>
          <option value="THIS_WEEK">This Week</option>
          <option value="LAST_30_DAYS">Last 30 Days</option>
          <option value="THIS_QUARTER">This Quarter</option>
          <option value="YTD">Year to Date (FY 2026-27)</option>
        </select>
        <select
          value={reportType}
          onChange={(e) => setReportType(e.target.value)}
          className="text-xs rounded-lg border border-input bg-background px-3 py-1.5 text-foreground"
        >
          <option value="ALL">All Operational Categories</option>
          <option value="MOTOR_ISSUANCE">Motor Policy Issuance</option>
          <option value="INSPECTION_SLA">Break-in Inspection SLAs</option>
          <option value="PREMIUM_COLLECTION">Finance & Collections</option>
          <option value="AGENT_CONVERSION">Agent Channel Velocity</option>
        </select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Gross Written Premium</span>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">₹24,85,600</div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            +18.4% vs last period
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Average Issuance Time</span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="text-2xl font-black text-foreground">4.2 min</div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            99.2% policies within 15 min SLA
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Inspections Cleared</span>
            <Car className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-foreground">94.8%</div>
          <div className="text-[11px] text-muted-foreground font-semibold">
            7-photo evidence mandatory
          </div>
        </div>

        <div className="p-4 rounded-xl border border-border bg-card space-y-2">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Reconciliation Match</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground">100%</div>
          <div className="text-[11px] text-emerald-600 font-semibold">
            Zero unresolved payment variances
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-bold text-foreground">Generated Operational Datasets</h2>
          <span className="text-xs text-muted-foreground">Updated in real time</span>
        </div>
        <div className="divide-y divide-border">
          {[
            {
              title: 'Daily Issuance Gate Log & Clearance Summary',
              category: 'Underwriting & Operations',
              freq: 'Daily (Automated)',
              records: '142 policies',
              format: 'CSV, PDF',
            },
            {
              title: 'Break-in Vehicle Inspection Turnaround & Photo Compliance',
              category: 'Inspection Desk',
              freq: 'Hourly',
              records: '28 inspections',
              format: 'CSV, ZIP Pack',
            },
            {
              title: 'Agent Ledger & Monotonic Commission Accrual Matrix',
              category: 'Finance & Agency',
              freq: 'Weekly',
              records: '3 active agents',
              format: 'CSV, XLSX',
            },
            {
              title: 'Bank Reconciliation & Zero-Tolerance Ledger Audit',
              category: 'General Ledger',
              freq: 'Continuous',
              records: '38 transactions',
              format: 'CSV',
            },
          ].map((r, i) => (
            <div key={i} className="p-4 flex items-center justify-between hover:bg-muted/40 transition">
              <div className="space-y-1">
                <div className="text-sm font-semibold text-foreground">{r.title}</div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-[10px] font-medium">
                    {r.category}
                  </span>
                  <span>Frequency: {r.freq}</span>
                  <span>Scope: {r.records}</span>
                </div>
              </div>
              <button
                onClick={() => toast.success(`Downloading ${r.title}...`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-foreground shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            </div>
          ))}
        </div>
      </div>
      </div>
    </AppShell>
  );
}
