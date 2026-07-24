'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  FileText,
  Download,
  Filter,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Layers,
  Shield,
  FileSpreadsheet,
} from 'lucide-react';
import { VisualizationStudio } from '../../../../components/reports/VisualizationStudio';

const MOCK_REPORT_EXECUTION = {
  id: 'RPT-001',
  name: 'Gross Written Premium (GWP) by Product Line & Insurer',
  category: 'POLICIES',
  description: 'Live breakdown of active policy count, IDV, and total premium grouped by insurance product line and partner insurer.',
  executedAt: '2026-07-24 11:45:00 IST',
  rowCount: 3,
  columns: [
    { key: 'insurerName', label: 'Insurer Partner', dataType: 'STRING' },
    { key: 'productLine', label: 'Product Line', dataType: 'STRING' },
    { key: 'policyCount', label: 'Active Policies', dataType: 'NUMBER' },
    { key: 'totalPremium', label: 'Total Premium (₹)', dataType: 'CURRENCY' },
    { key: 'commission', label: 'Retained Brokerage (₹)', dataType: 'CURRENCY' },
  ],
  data: [
    {
      insurerName: 'ICICI Lombard',
      productLine: 'Motor Comprehensive',
      policyCount: 142,
      totalPremium: 2350000,
      commission: 235000,
    },
    {
      insurerName: 'HDFC ERGO',
      productLine: 'Group Health Optima',
      policyCount: 48,
      totalPremium: 1850000,
      commission: 185000,
    },
    {
      insurerName: 'Star Health',
      productLine: 'Health Family Optima',
      policyCount: 32,
      totalPremium: 650000,
      commission: 65000,
    },
  ],
};

export default function ReportViewerPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = (params?.id as string) || 'RPT-001';

  const [drillBreadcrumbs, setDrillBreadcrumbs] = useState<string[]>([
    'All Revenue',
    'Insurer Partners',
  ]);
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ACTIVE');

  const handleDrillDown = (level: string) => {
    setDrillBreadcrumbs([...drillBreadcrumbs, level]);
  };

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div className="space-y-1">
          <button
            onClick={() => router.push('/dashboard/reports')}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Reports Catalog
          </button>

          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" /> {MOCK_REPORT_EXECUTION.name}
          </h1>
          <p className="text-xs text-muted-foreground">{MOCK_REPORT_EXECUTION.description}</p>
        </div>

        {/* Export Bar */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Exporting report as PDF...')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <Download className="h-3.5 w-3.5 text-red-500" />
            <span>PDF Export</span>
          </button>

          <button
            onClick={() => alert('Exporting report as Excel...')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />
            <span>Excel Export</span>
          </button>
        </div>
      </div>

      {/* Multilevel Drill-Down Breadcrumb Trail */}
      <div className="flex items-center space-x-2 p-3 rounded-xl border bg-muted/20 text-xs">
        <span className="font-bold text-muted-foreground uppercase text-[10px]">Drill-Down Path:</span>
        <div className="flex items-center space-x-1 overflow-x-auto">
          {drillBreadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb}>
              {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              <span
                onClick={() => setDrillBreadcrumbs(drillBreadcrumbs.slice(0, idx + 1))}
                className={`cursor-pointer px-2 py-0.5 rounded font-semibold ${
                  idx === drillBreadcrumbs.length - 1
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {crumb}
              </span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Filter Bar & Execution Metadata */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 p-3 rounded-xl border bg-card text-xs">
        <div className="flex items-center space-x-3">
          <span className="font-bold uppercase text-[10px] text-muted-foreground flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-primary" /> Active Filters:
          </span>
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value)}
            className="p-1.5 rounded border bg-background font-semibold text-xs"
          >
            <option value="ACTIVE">Policy Status: Active Only</option>
            <option value="ALL">Policy Status: All Statuses</option>
            <option value="RENEWAL_DUE">Policy Status: Renewals Due</option>
          </select>
        </div>

        <div className="flex items-center space-x-4 text-[11px] text-muted-foreground">
          <span>Executed At: <strong>{MOCK_REPORT_EXECUTION.executedAt}</strong></span>
          <span>Rows: <strong className="text-primary font-bold">{MOCK_REPORT_EXECUTION.rowCount}</strong></span>
        </div>
      </div>

      {/* Visualization Studio */}
      <VisualizationStudio
        data={MOCK_REPORT_EXECUTION.data}
        columns={MOCK_REPORT_EXECUTION.columns}
        title={MOCK_REPORT_EXECUTION.name}
        categoryKey="insurerName"
        valueKey="totalPremium"
      />

      {/* Data Table Grid with Clickable Drill-down Rows */}
      <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3 text-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <h3 className="font-bold text-sm">Detailed Data Table Grid (Click Row to Drill Down)</h3>
          <span className="text-[10px] text-muted-foreground font-semibold">
            {MOCK_REPORT_EXECUTION.rowCount} Total Records
          </span>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Insurer Partner</th>
                <th className="p-3">Product Line</th>
                <th className="p-3">Active Policies</th>
                <th className="p-3">Total Premium</th>
                <th className="p-3">Retained Brokerage</th>
                <th className="p-3 text-right">Drill-Down Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {MOCK_REPORT_EXECUTION.data.map((row, idx) => (
                <tr key={idx} className="hover:bg-accent/40 cursor-pointer" onClick={() => handleDrillDown(row.insurerName)}>
                  <td className="p-3 font-bold text-primary">{row.insurerName}</td>
                  <td className="p-3 font-semibold">{row.productLine}</td>
                  <td className="p-3 font-mono font-bold">{row.policyCount}</td>
                  <td className="p-3 font-mono font-bold text-emerald-600">₹{row.totalPremium.toLocaleString('en-IN')}</td>
                  <td className="p-3 font-mono font-extrabold text-foreground">₹{row.commission.toLocaleString('en-IN')}</td>
                  <td className="p-3 text-right">
                    <span className="text-[10px] text-primary font-bold hover:underline flex items-center justify-end gap-0.5">
                      Drill to Agents <ChevronRight className="h-3 w-3" />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
