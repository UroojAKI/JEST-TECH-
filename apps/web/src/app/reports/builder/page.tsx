'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import {
  BarChart3,
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  Layers,
  Sparkles,
  CheckCircle2,
  Table as TableIcon,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface MetricOption {
  id: string;
  label: string;
  unit: string;
}

const AVAILABLE_METRICS: MetricOption[] = [
  { id: 'gwp', label: 'Gross Written Premium (GWP)', unit: '₹' },
  { id: 'policiesIssued', label: 'Policies Issued', unit: 'Count' },
  { id: 'lossRatio', label: 'Loss Ratio', unit: '%' },
  { id: 'renewalRetention', label: 'Renewal Retention Rate', unit: '%' },
  { id: 'commissionExpense', label: 'Commission Expense', unit: '₹' },
];

const AVAILABLE_DIMENSIONS = [
  { id: 'insurer', label: 'Insurer Partner' },
  { id: 'branch', label: 'Branch / Region' },
  { id: 'agent', label: 'Sales Agent' },
  { id: 'policyType', label: 'Policy Type (Comprehensive, TP, SAOD)' },
  { id: 'month', label: 'Calendar Month' },
];

const MOCK_PREVIEW_DATA = [
  {
    dimension: 'HDFC ERGO',
    gwp: '₹14,50,000',
    policiesIssued: '142',
    lossRatio: '32.4%',
    renewalRetention: '84.2%',
    commissionExpense: '₹1,45,000',
  },
  {
    dimension: 'ICICI Lombard',
    gwp: '₹11,20,000',
    policiesIssued: '98',
    lossRatio: '28.1%',
    renewalRetention: '79.5%',
    commissionExpense: '₹1,12,000',
  },
  {
    dimension: 'Bajaj Allianz',
    gwp: '₹8,90,000',
    policiesIssued: '76',
    lossRatio: '35.0%',
    renewalRetention: '81.0%',
    commissionExpense: '₹89,000',
  },
  {
    dimension: 'Tata AIG',
    gwp: '₹6,40,000',
    policiesIssued: '52',
    lossRatio: '22.8%',
    renewalRetention: '88.3%',
    commissionExpense: '₹64,000',
  },
];

export default function CustomReportBuilderPage() {
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'gwp',
    'policiesIssued',
    'lossRatio',
  ]);
  const [selectedDimension, setSelectedDimension] = useState<string>('insurer');
  const [dateRange, setDateRange] = useState<string>('LAST_30_DAYS');
  const [isGenerating, setIsGenerating] = useState(false);

  const toggleMetric = (id: string) => {
    setSelectedMetrics((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((m) => m !== id) : prev) : [...prev, id],
    );
  };

  const handleExport = (format: 'csv' | 'pdf') => {
    if (format === 'csv') {
      const activeMetrics = AVAILABLE_METRICS.filter((m) => selectedMetrics.includes(m.id));
      const headers = ['Dimension', ...activeMetrics.map((m) => m.label)].join(',');
      const rows = MOCK_PREVIEW_DATA.map((row) =>
        [row.dimension, ...activeMetrics.map((m) => `"${(row as any)[m.id] || ''}"`)].join(','),
      ).join('\n');
      const csvContent = `${headers}\n${rows}`;
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `custom-report-${selectedDimension}-${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Custom report exported to CSV successfully');
    } else {
      toast.info('Generating PDF summary report...');
      setTimeout(() => {
        toast.success('PDF report generated and download initiated');
      }, 1000);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Analytics Engine • Custom Report Builder
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-0.5">
              Dynamic Report & Pivot Builder
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Select operational metrics, configure grouping dimensions, and export customized multi-dimensional datasets.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('csv')}
              className="px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent text-foreground shadow-xs flex items-center space-x-1.5"
            >
              <Download className="h-4 w-4" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Export PDF Summary</span>
            </button>
          </div>
        </div>

        {/* Builder Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Metrics Selection */}
          <div className="p-5 rounded-2xl border bg-card space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>1. Select Operational Metrics</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Choose the key performance indicators to display in columns.
            </p>
            <div className="space-y-2 pt-2">
              {AVAILABLE_METRICS.map((metric) => {
                const isChecked = selectedMetrics.includes(metric.id);
                return (
                  <button
                    key={metric.id}
                    onClick={() => toggleMetric(metric.id)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                      isChecked
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span>{metric.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-foreground font-mono">
                      {metric.unit}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dimension Grouping */}
          <div className="p-5 rounded-2xl border bg-card space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
              <Layers className="h-4 w-4 text-primary" />
              <span>2. Group By Dimension</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Determine the row segmentation entity for cross-tabulation.
            </p>
            <div className="space-y-2 pt-2">
              {AVAILABLE_DIMENSIONS.map((dim) => {
                const isSelected = selectedDimension === dim.id;
                return (
                  <button
                    key={dim.id}
                    onClick={() => setSelectedDimension(dim.id)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                    }`}
                  >
                    <span>{dim.label}</span>
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date Range & Filters */}
          <div className="p-5 rounded-2xl border bg-card space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
              <Calendar className="h-4 w-4 text-primary" />
              <span>3. Temporal Scope & Filters</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Set the reporting period window and temporal aggregation bounds.
            </p>
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] font-bold text-muted-foreground block mb-1 uppercase">
                  Time Period
                </label>
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="w-full p-2.5 text-xs rounded-xl border bg-background text-foreground font-medium"
                >
                  <option value="TODAY">Today</option>
                  <option value="LAST_7_DAYS">Last 7 Days</option>
                  <option value="LAST_30_DAYS">Last 30 Days</option>
                  <option value="THIS_QUARTER">This Quarter (Q3)</option>
                  <option value="YTD">Year to Date (FY 2026-27)</option>
                </select>
              </div>

              <div className="pt-2 border-t">
                <button
                  onClick={() => {
                    setIsGenerating(true);
                    setTimeout(() => {
                      setIsGenerating(false);
                      toast.success('Report data refreshed');
                    }, 400);
                  }}
                  disabled={isGenerating}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs hover:bg-primary/90"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                  <span>{isGenerating ? 'Recalculating...' : 'Apply & Run Query'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Live Data Preview */}
        <div className="border rounded-2xl overflow-hidden bg-card text-xs shadow-xs space-y-0">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <div className="flex items-center space-x-2 font-bold">
              <TableIcon className="h-4 w-4 text-primary" />
              <span>Live Dataset Preview</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {selectedMetrics.length} metrics × {MOCK_PREVIEW_DATA.length} rows
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Grouped by:{' '}
              <span className="font-bold text-foreground">
                {AVAILABLE_DIMENSIONS.find((d) => d.id === selectedDimension)?.label}
              </span>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3.5">
                  {AVAILABLE_DIMENSIONS.find((d) => d.id === selectedDimension)?.label || 'Dimension'}
                </th>
                {AVAILABLE_METRICS.filter((m) => selectedMetrics.includes(m.id)).map((m) => (
                  <th key={m.id} className="p-3.5 text-right">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {MOCK_PREVIEW_DATA.map((row, idx) => (
                <tr key={idx} className="hover:bg-accent/40">
                  <td className="p-3.5 font-bold text-foreground">{row.dimension}</td>
                  {AVAILABLE_METRICS.filter((m) => selectedMetrics.includes(m.id)).map((m) => (
                    <td key={m.id} className="p-3.5 text-right font-mono font-medium">
                      {(row as any)[m.id] || '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
