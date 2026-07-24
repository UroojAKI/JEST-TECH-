'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../../components/layout/app-shell';
import { Clock, Calendar, FileText, CheckCircle2, AlertTriangle, Plus, Download } from 'lucide-react';
import { useReportSchedules, useReportHistory } from '../../../../hooks/useReports';
import { StatusBadge } from '../../../../components/ui/status-badge';

const MOCK_SCHEDULES = [
  {
    id: 'SCH-01',
    reportName: 'Daily Gross Written Premium (GWP) Digest',
    frequency: 'DAILY',
    recipients: ['ceo@jest.com', 'cfo@jest.com'],
    nextRunAt: '2026-07-25 08:00 IST',
    lastRunAt: '2026-07-24 08:00 IST',
    status: 'ACTIVE',
  },
  {
    id: 'SCH-02',
    reportName: 'Weekly Renewal Retention & 45-Day Countdown',
    frequency: 'WEEKLY',
    recipients: ['renewals-head@jest.com'],
    nextRunAt: '2026-07-27 09:00 IST',
    lastRunAt: '2026-07-20 09:00 IST',
    status: 'ACTIVE',
  },
  {
    id: 'SCH-03',
    reportName: 'Monthly Agent Commission & Override Payout Summary',
    frequency: 'MONTHLY',
    recipients: ['finance@jest.com', 'accounts@jest.com'],
    nextRunAt: '2026-08-01 10:00 IST',
    lastRunAt: '2026-07-01 10:00 IST',
    status: 'ACTIVE',
  },
];

const MOCK_HISTORY = [
  {
    id: 'HIST-901',
    reportName: 'Gross Written Premium (GWP) by Product Line',
    executedBy: 'System Cron Scheduler',
    executedAt: '2026-07-24 08:00:14 IST',
    durationMs: 420,
    rowCount: 148,
    format: 'PDF',
    status: 'SUCCESS',
  },
  {
    id: 'HIST-902',
    reportName: 'Lead Conversion & Sales Pipeline Velocity',
    executedBy: 'Rajesh Sharma (Sales Mgr)',
    executedAt: '2026-07-23 16:40:22 IST',
    durationMs: 280,
    rowCount: 92,
    format: 'EXCEL',
    status: 'SUCCESS',
  },
  {
    id: 'HIST-903',
    reportName: 'Insurer Net Settlement Statement',
    executedBy: 'Sunil Verma (Finance)',
    executedAt: '2026-07-21 17:30:10 IST',
    durationMs: 310,
    rowCount: 12,
    format: 'CSV',
    status: 'SUCCESS',
  },
];

export default function ReportHistoryPage() {
  const [activeSubTab, setActiveSubTab] = useState<'SCHEDULES' | 'HISTORY'>('SCHEDULES');

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Scheduled Reports & Execution Audit History
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage automated recurring report dispatches (Daily, Weekly, Monthly) and review execution logs
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Opening Create New Report Schedule Modal...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create Schedule</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        <button
          onClick={() => setActiveSubTab('SCHEDULES')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeSubTab === 'SCHEDULES'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Active Report Schedules ({MOCK_SCHEDULES.length})
        </button>
        <button
          onClick={() => setActiveSubTab('HISTORY')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeSubTab === 'HISTORY'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Execution History Logs ({MOCK_HISTORY.length})
        </button>
      </div>

      {/* SCHEDULES TAB */}
      {activeSubTab === 'SCHEDULES' && (
        <div className="border rounded-xl overflow-hidden bg-card text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Schedule ID</th>
                <th className="p-3">Report Name</th>
                <th className="p-3">Frequency</th>
                <th className="p-3">Recipients</th>
                <th className="p-3">Next Run</th>
                <th className="p-3">Last Run</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {MOCK_SCHEDULES.map((sch) => (
                <tr key={sch.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{sch.id}</td>
                  <td className="p-3 font-semibold">{sch.reportName}</td>
                  <td className="p-3 font-bold">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground border text-[10px]">
                      {sch.frequency}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{sch.recipients.join(', ')}</td>
                  <td className="p-3 font-mono text-emerald-600 font-bold">{sch.nextRunAt}</td>
                  <td className="p-3 font-mono text-muted-foreground">{sch.lastRunAt}</td>
                  <td className="p-3"><StatusBadge status={sch.status} /></td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => alert(`Pausing schedule ${sch.id}...`)}
                      className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                    >
                      Pause
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeSubTab === 'HISTORY' && (
        <div className="border rounded-xl overflow-hidden bg-card text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Log ID</th>
                <th className="p-3">Report Executed</th>
                <th className="p-3">Executed By</th>
                <th className="p-3">Execution Time</th>
                <th className="p-3">Duration</th>
                <th className="p-3">Rows</th>
                <th className="p-3">Format</th>
                <th className="p-3 text-right">Download</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {MOCK_HISTORY.map((hist) => (
                <tr key={hist.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{hist.id}</td>
                  <td className="p-3 font-semibold">{hist.reportName}</td>
                  <td className="p-3 text-muted-foreground">{hist.executedBy}</td>
                  <td className="p-3 font-mono">{hist.executedAt}</td>
                  <td className="p-3 font-mono text-muted-foreground">{hist.durationMs}ms</td>
                  <td className="p-3 font-mono font-bold">{hist.rowCount}</td>
                  <td className="p-3 font-bold text-primary">{hist.format}</td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => alert(`Downloading ${hist.reportName} ${hist.format}...`)}
                      className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px] flex items-center justify-end space-x-1 ml-auto"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
