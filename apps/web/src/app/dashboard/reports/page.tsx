'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import {
  FileText,
  Plus,
  Star,
  Clock,
  Calendar,
  Download,
  Search,
  Filter,
  Play,
  ArrowRight,
  TrendingUp,
  Shield,
  PieChart,
  SlidersHorizontal,
} from 'lucide-react';
import { useReports } from '../../../hooks/useReports';

const REPORT_TEMPLATES = [
  {
    id: 'RPT-001',
    name: 'Gross Written Premium (GWP) by Product Line',
    category: 'POLICIES',
    description: 'Breakdown of active policy count, IDV, and total premium grouped by insurance product line.',
    isFavorite: true,
    lastRun: '2026-07-24 10:15 IST',
    rowCount: 148,
  },
  {
    id: 'RPT-002',
    name: 'Lead Conversion & Sales Pipeline Velocity',
    category: 'SALES',
    description: 'Stage conversion metrics, lead score distribution, win ratios, and agent performance.',
    isFavorite: true,
    lastRun: '2026-07-23 16:40 IST',
    rowCount: 92,
  },
  {
    id: 'RPT-003',
    name: '45-Day Renewal Retention & Expiry Cockpit',
    category: 'RENEWALS',
    description: 'Upcoming expiry countdown tracking, campaign status, and grace period recovery rates.',
    isFavorite: true,
    lastRun: '2026-07-24 09:00 IST',
    rowCount: 34,
  },
  {
    id: 'RPT-004',
    name: 'Claims Settlement Duration & Reserve Exposure',
    category: 'CLAIMS',
    description: 'Claim severity, settlement turnaround times, reserve exposure, and surveyor assessment logs.',
    isFavorite: false,
    lastRun: '2026-07-22 14:20 IST',
    rowCount: 18,
  },
  {
    id: 'RPT-005',
    name: 'Agent Commission & Manager Override Ledger',
    category: 'FINANCE',
    description: 'Accrued vs realized brokerage commission, multi-tier manager override payouts, and status.',
    isFavorite: false,
    lastRun: '2026-07-20 11:10 IST',
    rowCount: 210,
  },
  {
    id: 'RPT-006',
    name: 'Insurer Net Settlement & Brokerage Retained',
    category: 'FINANCE',
    description: 'Gross premium collected vs commission retained and net payable calculations per insurer.',
    isFavorite: false,
    lastRun: '2026-07-21 17:30 IST',
    rowCount: 12,
  },
];

export default function ReportsHubPage() {
  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredReports = REPORT_TEMPLATES.filter((r) => {
    const matchesCategory = selectedCategory === 'ALL' || r.category === selectedCategory;
    const matchesSearch = r.name.toLowerCase().includes(searchQuery.toLowerCase()) || r.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" /> Self-Service Business Intelligence & Reports Catalog
          </h1>
          <p className="text-xs text-muted-foreground">
            Explore report templates, execute live queries, design custom reports, schedule automated dispatches, and export data
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push('/dashboard/reports/history')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Schedules & History</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/reports/executive')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            <span>Executive Dashboards</span>
          </button>

          <button
            onClick={() => router.push('/dashboard/reports/builder')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Design New Report</span>
          </button>
        </div>
      </div>

      {/* Category Pills & Search Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-card p-3 rounded-xl border">
        {/* Category Pills */}
        <div className="flex border-b sm:border-b-0 text-xs overflow-x-auto p-1 space-x-1">
          {[
            { id: 'ALL', label: 'All Reports' },
            { id: 'SALES', label: 'Sales & Leads' },
            { id: 'POLICIES', label: 'Policies' },
            { id: 'RENEWALS', label: 'Renewals' },
            { id: 'CLAIMS', label: 'Claims' },
            { id: 'FINANCE', label: 'Finance & Commission' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-md font-semibold whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Reports Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
        {filteredReports.map((report) => (
          <div
            key={report.id}
            className="p-5 rounded-2xl border bg-card hover:border-primary/40 transition-all shadow-sm flex flex-col justify-between space-y-4"
          >
            <div className="space-y-2">
              <div className="flex justify-between items-start">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {report.category}
                </span>
                <button
                  onClick={() => alert(`Toggled favorite for ${report.name}`)}
                  className="text-amber-500 hover:scale-110 transition-transform"
                >
                  <Star className={`h-4 w-4 ${report.isFavorite ? 'fill-amber-500' : 'text-muted-foreground'}`} />
                </button>
              </div>

              <h3 className="font-bold text-sm text-foreground hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/dashboard/reports/${report.id}`)}>
                {report.name}
              </h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{report.description}</p>
            </div>

            <div className="pt-3 border-t space-y-3">
              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Last Run: <strong>{report.lastRun}</strong></span>
                <span>Records: <strong>{report.rowCount}</strong></span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => router.push(`/dashboard/reports/${report.id}`)}
                  className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center space-x-1 shadow hover:bg-primary/90"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  <span>Execute & View</span>
                </button>

                <button
                  onClick={() => alert(`Exporting ${report.name} PDF...`)}
                  className="p-2 rounded-lg border bg-background hover:bg-accent text-foreground"
                  title="Export PDF"
                >
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
