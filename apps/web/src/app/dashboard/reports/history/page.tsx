'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../../components/layout/app-shell';
import { Clock, Calendar, FileText, CheckCircle2, AlertTriangle, Plus, Download } from 'lucide-react';
import { useReportSchedules, useReportHistory } from '../../../../hooks/useReports';
import { StatusBadge } from '../../../../components/ui/status-badge';



import { toast } from 'sonner';

export default function ReportHistoryPage() {
  const [activeSubTab, setActiveSubTab] = useState<'SCHEDULES' | 'HISTORY'>('SCHEDULES');
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [reportName, setReportName] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [recipients, setRecipients] = useState('');
  const [format, setFormat] = useState<'PDF' | 'EXCEL' | 'CSV'>('PDF');

  const { schedules, createSchedule, isCreating: isCreatingSchedule } = useReportSchedules();
  const { data: history = [] } = useReportHistory();

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
            onClick={() => setShowScheduleForm(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create Schedule</span>
          </button>
        </div>
      </div>

      {showScheduleForm && (
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-4 mb-4">
          <h2 className="text-sm font-bold">Create New Report Schedule</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Report Name</label>
              <input type="text" className="w-full p-2 border rounded" value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="e.g. Daily GWP" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Frequency</label>
              <select className="w-full p-2 border rounded" value={frequency} onChange={(e) => setFrequency(e.target.value as any)}>
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Recipients (comma separated)</label>
              <input type="text" className="w-full p-2 border rounded" value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="email@jest.com" />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Format</label>
              <select className="w-full p-2 border rounded" value={format} onChange={(e) => setFormat(e.target.value as any)}>
                <option value="PDF">PDF</option>
                <option value="EXCEL">Excel</option>
                <option value="CSV">CSV</option>
              </select>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              disabled={isCreatingSchedule}
              onClick={() => {
                createSchedule({
                  reportName,
                  frequency,
                  recipients: recipients.split(',').map(r => r.trim()).filter(Boolean),
                  format,
                }, {
                  onSuccess: () => {
                    toast.success('Schedule created successfully!');
                    setShowScheduleForm(false);
                  }
                });
              }}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow"
            >
              {isCreatingSchedule ? 'Saving...' : 'Save Schedule'}
            </button>
            <button onClick={() => setShowScheduleForm(false)} className="px-4 py-2 text-xs font-bold rounded-lg border bg-background hover:bg-accent text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

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
          Active Report Schedules ({schedules?.length || 0})
        </button>
        <button
          onClick={() => setActiveSubTab('HISTORY')}
          className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
            activeSubTab === 'HISTORY'
              ? 'bg-primary text-primary-foreground shadow'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground'
          }`}
        >
          Execution History Logs ({history?.length || 0})
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
              {schedules?.map((sch: any) => (
                <tr key={sch.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{sch.id}</td>
                  <td className="p-3 font-semibold">{sch.reportName}</td>
                  <td className="p-3 font-bold">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground border text-[10px]">
                      {sch.frequency}
                    </span>
                  </td>
                  <td className="p-3 text-muted-foreground">{sch.recipients?.join(', ')}</td>
                  <td className="p-3 font-mono text-emerald-600 font-bold">{sch.nextRunAt}</td>
                  <td className="p-3 font-mono text-muted-foreground">{sch.lastRunAt}</td>
                  <td className="p-3"><StatusBadge status={sch.status} /></td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => toast.info('Schedule paused!')}
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
              {history?.map((hist: any) => (
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
                      onClick={() => window.open(`/api/v1/reports/history/${hist.id}/download`, '_blank')}
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
