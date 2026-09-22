'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import {
  BarChart3,
  Download,
  Calendar,
  Layers,
  Sparkles,
  CheckCircle2,
  Table as TableIcon,
  RefreshCw,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  reportsRepository,
  ReportDefinition,
  ReportExecutionResult,
} from '../../../repositories/reports.repository';

export default function CustomReportBuilderPage() {
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string>('');
  const [selectedDimension, setSelectedDimension] = useState<string>('insurer');
  const [dateRange, setDateRange] = useState<string>('LAST_30_DAYS');
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [executionResult, setExecutionResult] = useState<ReportExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load available reports on mount
  useEffect(() => {
    async function loadReports() {
      try {
        setIsLoadingReports(true);
        const data = await reportsRepository.getReports();
        const activeReports = Array.isArray(data) ? data : [];
        setReports(activeReports);
        if (activeReports.length > 0) {
          setSelectedReportId(activeReports[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load reports:', err);
        setError(err?.response?.data?.message || err.message || 'Failed to load report templates');
      } finally {
        setIsLoadingReports(false);
      }
    }
    loadReports();
  }, []);

  // Run execution whenever selected report or parameters change
  const handleRunQuery = async (targetReportId?: string) => {
    const reportId = targetReportId || selectedReportId;
    if (!reportId) {
      toast.error('Please select a report template');
      return;
    }

    try {
      setIsExecuting(true);
      setError(null);
      const result = await reportsRepository.executeReport(reportId, {
        filters: { dateRange, dimension: selectedDimension },
        groupBy: [selectedDimension],
      });
      setExecutionResult(result);
      toast.success(`Report query completed (${result.rowCount || result.data?.length || 0} records)`);
    } catch (err: any) {
      console.error('Report execution failed:', err);
      const msg = err?.response?.data?.message || err.message || 'Execution failed';
      setError(msg);
      toast.error(`Report execution error: ${msg}`);
    } finally {
      setIsExecuting(false);
    }
  };

  useEffect(() => {
    if (selectedReportId) {
      handleRunQuery(selectedReportId);
    }
  }, [selectedReportId]);

  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!selectedReportId) {
      toast.error('No report selected for export');
      return;
    }

    try {
      setIsExporting(true);
      const exportFormat = format === 'pdf' ? 'PDF' : 'CSV';
      toast.info(`Preparing ${exportFormat} export from backend engine...`);
      
      const blob = await reportsRepository.exportReport(selectedReportId, exportFormat);
      const url = window.URL.createObjectURL(new Blob([blob], {
        type: format === 'pdf' ? 'application/pdf' : 'text/csv;charset=utf-8;'
      }));
      
      const activeReport = reports.find((r) => r.id === selectedReportId);
      const filename = `${activeReport?.code || 'report'}-${selectedDimension}-${Date.now()}.${format}`;
      
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`${exportFormat} report exported successfully`);
    } catch (err: any) {
      console.error('Export error:', err);
      const msg = err?.response?.data?.message || err.message || 'Export request failed';
      toast.error(`Export failed: ${msg}`);
    } finally {
      setIsExporting(false);
    }
  };

  const activeReport = reports.find((r) => r.id === selectedReportId);
  const columns = executionResult?.columns || activeReport?.columns || [];
  const rows = executionResult?.data || [];

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
              Select operational templates, configure grouping dimensions, and export verified multi-dimensional datasets.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting || !selectedReportId}
              className="px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent text-foreground shadow-xs flex items-center space-x-1.5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
            </button>
            <button
              onClick={() => handleExport('pdf')}
              disabled={isExporting || !selectedReportId}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 flex items-center space-x-1.5 disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>{isExporting ? 'Generating...' : 'Export PDF Summary'}</span>
            </button>
          </div>
        </div>

        {/* Builder Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report Template Selection */}
          <div className="p-5 rounded-2xl border bg-card space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              <span>1. Select Report Template</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Choose an authoritative analytical schema to execute.
            </p>
            <div className="space-y-2 pt-2">
              {isLoadingReports ? (
                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                  Loading report schemas...
                </div>
              ) : reports.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground border rounded-xl">
                  No active report templates found.
                </div>
              ) : (
                reports.map((report) => {
                  const isChecked = selectedReportId === report.id;
                  return (
                    <button
                      key={report.id}
                      onClick={() => setSelectedReportId(report.id)}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-colors ${
                        isChecked
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted/40'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-foreground">{report.name}</div>
                        <div className="text-[10px] text-muted-foreground">{report.code} • {report.category}</div>
                      </div>
                      {isChecked && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                    </button>
                  );
                })
              )}
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
              {[
                { id: 'insurer', label: 'Insurer Partner' },
                { id: 'branch', label: 'Branch / Region' },
                { id: 'agent', label: 'Sales Agent' },
                { id: 'policyType', label: 'Policy Type (Comprehensive, TP, SAOD)' },
                { id: 'month', label: 'Calendar Month' },
              ].map((dim) => {
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
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
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
                  onClick={() => handleRunQuery()}
                  disabled={isExecuting || !selectedReportId}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center space-x-1.5 shadow-xs hover:bg-primary/90 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isExecuting ? 'animate-spin' : ''}`} />
                  <span>{isExecuting ? 'Querying Engine...' : 'Apply & Run Query'}</span>
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
              {executionResult && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {columns.length} columns × {rows.length} rows
                </span>
              )}
            </div>
            <div className="text-[10px] text-muted-foreground">
              Active Template: <span className="font-bold text-foreground">{activeReport?.name || 'None'}</span>
            </div>
          </div>

          {isExecuting ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <RefreshCw className="h-6 w-6 text-primary animate-spin" />
              <span className="font-bold">Executing analytical aggregation query on reporting engine...</span>
            </div>
          ) : error ? (
            <div className="p-8 text-center text-xs text-destructive flex flex-col items-center gap-2">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <span className="font-bold">Query Execution Failed</span>
              <p className="text-muted-foreground text-[11px] max-w-md">{error}</p>
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <TableIcon className="h-8 w-8 text-muted-foreground/40" />
              <span className="font-bold text-foreground">No Records Found</span>
              <p className="text-[11px]">No data records match the selected scope and temporal bounds.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                    {columns.map((col) => (
                      <th key={col.key} className="p-3.5">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-accent/40">
                      {columns.map((col) => (
                        <td key={col.key} className="p-3.5 font-mono text-[11px]">
                          {row[col.key] !== undefined && row[col.key] !== null
                            ? String(row[col.key])
                            : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
