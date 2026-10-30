'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import {
  FileCode,
  Search,
  ShieldCheck,
  Eye,
  X,
  Loader2,
  Lock,
  Download,
  ChevronLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { useAuditLogs } from '../../../hooks/useAdmin';
import { adminRepository } from '../../../repositories/admin.repository';
import { toast } from 'sonner';
import Link from 'next/link';

export default function AuditCenterPage() {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [entityFilter, setEntityFilter] = useState<string>('ALL');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: auditResponse, isLoading } = useAuditLogs({
    search: debouncedQuery || undefined,
    action: actionFilter !== 'ALL' ? actionFilter : undefined,
    entity: entityFilter !== 'ALL' ? entityFilter : undefined,
    page,
    limit,
  });

  const logs: any[] = Array.isArray(auditResponse)
    ? auditResponse
    : ((auditResponse as any)?.data || []);

  const meta = (auditResponse as any)?.meta || {
    page,
    limit,
    total: logs.length,
    totalPages: Math.ceil(logs.length / limit) || 1,
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setIsExporting(true);
      toast.info('Exporting authoritative audit trail logs...');
      const blob = await adminRepository.exportAuditLogs({
        format,
        search: debouncedQuery || undefined,
        action: actionFilter !== 'ALL' ? actionFilter : undefined,
        entity: entityFilter !== 'ALL' ? entityFilter : undefined,
      });

      const url = window.URL.createObjectURL(
        new Blob([blob], {
          type:
            format === 'csv'
              ? 'text/csv;charset=utf-8;'
              : 'application/json',
        }),
      );
      const filename = `audit-trail-${Date.now()}.${format}`;
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Audit trail logs exported successfully');
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error(
        err?.response?.data?.message || err.message || 'Audit export failed',
      );
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell activeWorkspace="ADMIN">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" /> Enterprise Audit Center & State Diff Explorer (R13)
            </h1>
            <p className="text-xs text-muted-foreground">
              Immutable audit logs (G023), transactional state capture (G022), correlation tracing, and JSON state diff inspection.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('csv')}
              disabled={isExporting}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-card hover:bg-accent text-foreground shadow-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Exporting...' : 'Export Audit Log'}</span>
            </button>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 text-xs font-bold">
              <Lock className="h-3.5 w-3.5" />
              <span>Append-Only Immutability Active</span>
            </div>
          </div>
        </div>

        {/* Audit Sections Tabs */}
        <div className="flex border-b border-border space-x-6 text-xs font-semibold">
          <Link
            href="/admin/audit"
            className="pb-2.5 border-b-2 border-primary text-primary flex items-center gap-2"
          >
            <FileCode className="h-4 w-4" />
            <span>System Audit Trail</span>
          </Link>
          <Link
            href="/admin/audit-reports"
            className="pb-2.5 border-b-2 border-transparent text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Policy Audit Report</span>
          </Link>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by entity ID, correlation ID, or user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>

          <div>
            <select
              value={actionFilter}
              onChange={(e) => {
                setActionFilter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="LOGIN">LOGIN</option>
              <option value="LOGOUT">LOGOUT</option>
              <option value="PASSWORD_RESET">PASSWORD_RESET</option>
              <option value="EXPORT">EXPORT</option>
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
            </select>
          </div>

          <div>
            <select
              value={entityFilter}
              onChange={(e) => {
                setEntityFilter(e.target.value);
                setPage(1);
              }}
              className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
            >
              <option value="ALL">All Entities</option>
              <option value="USER">USER</option>
              <option value="POLICY">POLICY</option>
              <option value="CLAIM">CLAIM</option>
              <option value="LEAD">LEAD</option>
              <option value="QUOTATION">QUOTATION</option>
              <option value="CONTACT">CONTACT</option>
              <option value="COMPANY">COMPANY</option>
              <option value="ROLE">ROLE</option>
            </select>
          </div>
        </div>

        {/* Audit Logs Grid Table */}
        <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Log ID</th>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Actor / User</th>
                <th className="p-3">Module / Entity</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity ID</th>
                <th className="p-3 text-right">Inspect Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span>Loading immutable audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No audit records found matching query.
                  </td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-accent/40 transition">
                    <td className="p-3 font-mono font-bold text-primary">{log.id.slice(0, 8)}...</td>
                    <td className="p-3 font-mono text-muted-foreground text-[11px]">
                      {new Date(log.createdAt || log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="p-3 font-semibold">
                      {log.user?.email || log.user?.firstName || log.userId || log.userEmail || 'SYSTEM'}
                    </td>
                    <td className="p-3 font-bold text-[10px] uppercase text-muted-foreground">
                      {log.module || log.entity}
                    </td>
                    <td className="p-3">
                      <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-[11px]">{log.entityId}</td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px] inline-flex items-center gap-1 ml-auto"
                      >
                        <Eye className="h-3 w-3" />
                        <span>View Diff</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination Controls */}
          <div className="p-3 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div>
              Showing <span className="font-bold text-foreground">{logs.length}</span> of{' '}
              <span className="font-bold text-foreground">{meta.total}</span> records
              (Page <span className="font-bold text-foreground">{meta.page}</span> of{' '}
              <span className="font-bold text-foreground">{meta.totalPages}</span>)
            </div>

            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-lg border bg-background text-foreground text-xs font-medium"
              >
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 text-foreground"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 text-foreground"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* JSON Diff Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <h3 className="font-bold text-sm">Audit State Diff: {selectedLog.id}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">Correlation: {selectedLog.correlationId || 'N/A'}</p>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-red-500 uppercase text-[10px]">Before State</span>
                  <pre className="p-3 rounded-lg border bg-muted/20 font-mono text-[10px] overflow-x-auto text-red-600 dark:text-red-400 max-h-80 overflow-y-auto">
                    {JSON.stringify(selectedLog.oldValue || selectedLog.beforeState || 'None (Created)', null, 2)}
                  </pre>
                </div>

                <div className="space-y-1">
                  <span className="font-bold text-emerald-500 uppercase text-[10px]">After State</span>
                  <pre className="p-3 rounded-lg border bg-muted/20 font-mono text-[10px] overflow-x-auto text-emerald-600 dark:text-emerald-400 max-h-80 overflow-y-auto">
                    {JSON.stringify(selectedLog.newValue || selectedLog.afterState, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
