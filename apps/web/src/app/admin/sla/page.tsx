'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Clock, AlertTriangle, ShieldCheck, RefreshCw, Activity } from 'lucide-react';
import { useSlaMetrics } from '../../../hooks/useWorkflows';

function metric(value: number | null | undefined, suffix = '') {
  return value === null || value === undefined || !Number.isFinite(Number(value))
    ? '—'
    : String(value) + suffix;
}

export default function SlaDashboardPage() {
  const { data, isLoading, isError, refetch, isFetching } = useSlaMetrics();
  const hasTrackedData = Boolean(data && (data.trackedInstances ?? 0) > 0);

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" /> Operational SLA &amp; Turnaround Time
            </h1>
            <p className="text-xs text-muted-foreground">
              Metrics are calculated from persisted workflow transitions and configured state SLA limits. Missing configuration is shown as unavailable, not estimated.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh metrics
          </button>
        </div>

        {isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">SLA metrics could not be loaded.</p>
            <p className="mt-1 text-xs text-muted-foreground">No fallback figures are displayed because that would misrepresent operational performance.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <MetricCard label="Active workflow instances" value={isLoading ? '…' : metric(data?.runningInstances)} icon={<Activity className="h-4 w-4" />} />
              <MetricCard label="Instances with configured SLA" value={isLoading ? '…' : metric(data?.trackedInstances)} icon={<Clock className="h-4 w-4" />} />
              <MetricCard label="SLA breaches" value={isLoading ? '…' : metric(data?.breachedCount)} icon={<AlertTriangle className="h-4 w-4" />} danger={Boolean(data?.breachedCount)} />
              <MetricCard label="Current-stage SLA compliance" value={isLoading ? '…' : metric(data?.overallCompliancePct, '%')} icon={<ShieldCheck className="h-4 w-4" />} />
            </div>

            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h2 className="text-sm font-bold">What these numbers mean</h2>
              {hasTrackedData ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-muted-foreground">Lead workflow compliance</div>
                    <div className="mt-1 text-lg font-bold">{metric(data?.leadsSlaCompliancePct, '%')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Claim workflow compliance</div>
                    <div className="mt-1 text-lg font-bold">{metric(data?.claimsSlaCompliancePct, '%')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Average time in current stage</div>
                    <div className="mt-1 text-lg font-bold">{metric(data?.avgCurrentStageHours, ' hours')}</div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
                  {isLoading
                    ? 'Loading live SLA records…'
                    : 'No active workflow instances with configured state-level SLA limits were returned. Configure state SLA minutes and execute workflows to populate this dashboard.'}
                </div>
              )}
              <p className="text-[11px] text-muted-foreground">
                Compliance here reflects active workflow instances with a configured state SLA. It is not a historical department-resolution KPI; historical resolution reporting must be derived from a validated SLA event history.
              </p>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function MetricCard({ label, value, icon, danger = false }: {
  label: string;
  value: string;
  icon: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-[10px] font-bold uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className={`text-2xl font-black ${danger ? 'text-destructive' : 'text-foreground'}`}>{value}</div>
    </div>
  );
}
