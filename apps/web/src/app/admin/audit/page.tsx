'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { FileCode, Search, Filter, ShieldCheck, Eye, X } from 'lucide-react';
import { useAuditLogs } from '../../../hooks/useAdmin';

const MOCK_AUDIT_LOGS = [
  {
    id: 'AUD-99102',
    timestamp: '2026-07-24 11:42:18 IST',
    userEmail: 'admin@jest.com',
    userRole: 'ADMIN',
    module: 'POLICY_OPERATIONS',
    action: 'POLICY_RENEWED',
    entityId: 'POL-001048',
    correlationId: 'CORR-881920-A',
    beforeState: { status: 'RENEWAL_DUE', expiryDate: '2026-08-15', totalPremium: 16545 },
    afterState: { status: 'ACTIVE', expiryDate: '2027-08-15', totalPremium: 16545 },
    ipAddress: '192.168.1.45',
  },
  {
    id: 'AUD-99103',
    timestamp: '2026-07-24 10:15:00 IST',
    userEmail: 'superadmin@jest.com',
    userRole: 'SUPER_ADMIN',
    module: 'FINANCE',
    action: 'JOURNAL_POSTED',
    entityId: 'JE-2026-001',
    correlationId: 'CORR-881921-B',
    beforeState: null,
    afterState: { entryNumber: 'JE-2026-001', amount: 16545, status: 'POSTED' },
    ipAddress: '192.168.1.10',
  },
];

export default function AuditCenterPage() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <FileCode className="h-5 w-5 text-primary" /> Enterprise Audit Center & State Diff Explorer
          </h1>
          <p className="text-xs text-muted-foreground">Immutable audit logs, user action tracking, correlation IDs, and JSON state diff inspection</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by user, action, entity ID, correlation ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
      </div>

      {/* Audit Logs Grid Table */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Log ID</th>
              <th className="p-3">Timestamp</th>
              <th className="p-3">User Email</th>
              <th className="p-3">Module</th>
              <th className="p-3">Action</th>
              <th className="p-3">Entity ID</th>
              <th className="p-3 text-right">Inspect Diff</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_AUDIT_LOGS.map((log) => (
              <tr key={log.id} className="hover:bg-accent/40">
                <td className="p-3 font-mono font-bold text-primary">{log.id}</td>
                <td className="p-3 font-mono text-muted-foreground">{log.timestamp}</td>
                <td className="p-3 font-semibold">{log.userEmail}</td>
                <td className="p-3 font-bold text-[10px] uppercase text-muted-foreground">{log.module}</td>
                <td className="p-3 font-bold text-emerald-600">{log.action}</td>
                <td className="p-3 font-mono">{log.entityId}</td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => setSelectedLog(log)}
                    className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px] flex items-center justify-end space-x-1 ml-auto"
                  >
                    <Eye className="h-3 w-3" />
                    <span>View Diff</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* JSON Diff Inspector Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">Audit State Diff: {selectedLog.id}</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="font-bold text-red-500 uppercase text-[10px]">Before State</span>
                <pre className="p-3 rounded-lg border bg-muted/20 font-mono text-[10px] overflow-x-auto text-red-600 dark:text-red-400">
                  {JSON.stringify(selectedLog.beforeState || 'None (Created)', null, 2)}
                </pre>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-emerald-500 uppercase text-[10px]">After State</span>
                <pre className="p-3 rounded-lg border bg-muted/20 font-mono text-[10px] overflow-x-auto text-emerald-600 dark:text-emerald-400">
                  {JSON.stringify(selectedLog.afterState, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
