'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FileSpreadsheet, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { AppShell } from '../../components/layout/app-shell';
import {
  ReportDefinition,
  reportsRepository,
} from '../../repositories/reports.repository';

const categories = [
  'SALES',
  'POLICIES',
  'RENEWALS',
  'CLAIMS',
  'FINANCE',
  'CUSTOMERS',
  'COMPLIANCE',
  'AUDIT',
] as const;

export default function ReportsPage() {
  const [category, setCategory] = useState('ALL');
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setIsLoading(true);
    setError(null);
    reportsRepository
      .getReports(category === 'ALL' ? undefined : { category })
      .then((result) => {
        if (active) setReports(Array.isArray(result) ? result : []);
      })
      .catch((err: any) => {
        if (active) {
          setError(
            err?.response?.data?.message || 'Could not load available reports.',
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [category]);

  const downloadReport = async (
    report: ReportDefinition,
    format: 'CSV' | 'PDF',
  ) => {
    const key = `${report.id}:${format}`;
    setExporting(key);
    try {
      const blob = await reportsRepository.exportReport(report.id, format);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${report.code.toLowerCase()}-${Date.now()}.${format.toLowerCase()}`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`${format} report downloaded`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || `Could not export ${report.name}.`,
      );
    } finally {
      setExporting(null);
    }
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        <header className="flex flex-col justify-between gap-4 border-b pb-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Operational &amp; Performance Reports
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a report from the reporting engine or configure a query in
              the report builder.
            </p>
          </div>
          <Link
            href="/reports/builder"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Open report builder
          </Link>
        </header>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
          <label htmlFor="report-category" className="text-xs font-semibold">
            Category
          </label>
          <select
            id="report-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs"
          >
            <option value="ALL">All reports</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading reports…
          </div>
        ) : error ? (
          <div role="alert" className="rounded-xl border p-6 text-sm text-destructive">
            {error}
          </div>
        ) : reports.length === 0 ? (
          <div className="rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
            No reports are available for this category.
          </div>
        ) : (
          <div className="divide-y rounded-xl border bg-card">
            {reports.map((report) => (
              <article
                key={report.id}
                className="flex flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <h2 className="text-sm font-semibold">{report.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {report.description || report.code} · {report.category} ·{' '}
                    {report.columns.length} columns
                  </p>
                </div>
                <div className="flex gap-2">
                  {(['CSV', 'PDF'] as const).map((format) => {
                    const busy = exporting === `${report.id}:${format}`;
                    return (
                      <button
                        key={format}
                        type="button"
                        onClick={() => void downloadReport(report, format)}
                        disabled={exporting !== null}
                        className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold disabled:cursor-wait disabled:opacity-50"
                      >
                        {busy ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        Export {format}
                      </button>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
