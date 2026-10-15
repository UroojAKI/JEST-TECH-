'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { FileCode, Search, Eye, X, Loader2, Lock, Download, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuditLogs } from '../../../hooks/useAdmin';
import { adminRepository } from '../../../repositories/admin.repository';

const PAGE_SIZE = 25;

export default function AuditCenterPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, entityFilter, actionFilter, userIdFilter]);

  const params = {
    search: debouncedQuery || undefined,
    entity: entityFilter.trim() || undefined,
    action: actionFilter.trim() || undefined,
    userId: userIdFilter.trim() || undefined,
    page,
    limit: PAGE_SIZE,
  };
  const { data: auditResponse, isLoading, isFetching, isError, refetch } = useAuditLogs(params);
  const logs: any[] = Array.isArray(auditResponse)
    ? auditResponse
    : Array.isArray((auditResponse as any)?.data) ? (auditResponse as any).data : [];
  const meta = (auditResponse as any)?.meta || {};
  const total = Number(meta.total ?? logs.length);
  const totalPages = Math.max(1, Number(meta.totalPages ?? Math.ceil(total / PAGE_SIZE) || 1));

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await adminRepository.exportAuditLogs({
        search: debouncedQuery || undefined,
        entity: entityFilter.trim() || undefined,
        action: actionFilter.trim() || undefined,
        userId: userIdFilter.trim() || undefined,
      }, 'csv');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'audit-trail-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Audit export requested with the current filters.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Audit export failed');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <AppShell activeWorkspace="ADMIN">
      <div className="mx-auto max-w-7xl space-y-5 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <FileCode className="h-5 w-5 text-primary" /> Audit Trail Explorer
            </h1>
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
              Search persisted audit events, trace a correlation ID, inspect before/after state, and export the current filtered result. Audit records are read-only.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Read-only trail
            </span>
            <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">
              <RefreshCw className={'h-3.5 w-3.5 ' + (isFetching ? 'animate-spin' : '')} /> Refresh
            </button>
            <button type="button" onClick={() => void handleExport()} disabled={isExporting || isLoading || isError || logs.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 rounded-xl border bg-card p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input type="text" placeholder="Search entity, correlation ID, actor…" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <input type="text" placeholder="Entity (e.g. LEAD, POLICY)" value={entityFilter} onChange={(event) => setEntityFilter(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="text" placeholder="Action (e.g. UPDATE, CREATE)" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
          <input type="text" placeholder="Actor user ID (optional)" value={userIdFilter} onChange={(event) => setUserIdFilter(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        {isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Audit trail failed to load.</p>
            <p className="mt-1 text-xs text-muted-foreground">Check your role permission and organization access. No sample events are displayed as fallback.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{isLoading ? 'Loading audit events…' : total.toLocaleString('en-IN') + ' event(s) found'}</span>
              <span>{isFetching ? 'Updating results…' : 'Page ' + page + ' of ' + totalPages}</span>
            </div>

            <div className="overflow-x-auto rounded-xl border bg-card text-xs shadow-sm">
              <table className="w-full min-w-[950px] border-collapse text-left">
                <thead>
                  <tr className="border-b bg-muted/40 text-[10px] font-bold uppercase text-muted-foreground">
                    <th className="p-3">Timestamp / Correlation</th>
                    <th className="p-3">Actor</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity ID</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading audit events…</td></tr>
                  ) : logs.length === 0 ? (
                    <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No real audit events match these filters.</td></tr>
                  ) : logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-accent/30">
                      <td className="p-3">
                        <div className="font-mono text-[11px]">{log.createdAt ? new Date(log.createdAt).toLocaleString('en-IN') : 'Timestamp unavailable'}</div>
                        <div className="mt-1 max-w-[260px] truncate font-mono text-[10px] text-muted-foreground" title={log.correlationId || ''}>{log.correlationId || 'No correlation ID'}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">{log.user?.email || [log.user?.firstName, log.user?.lastName].filter(Boolean).join(' ') || log.userId || 'SYSTEM'}</div>
                        <div className="text-[10px] text-muted-foreground">{log.user?.role?.name || log.user?.role?.code || ''}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold">{log.module || log.entity || 'Unknown entity'}</div>
                        <div className="text-[10px] text-muted-foreground">{log.entity || ''}</div>
                      </td>
                      <td className="p-3"><span className="rounded bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{log.action || 'UNKNOWN'}</span></td>
                      <td className="p-3 font-mono text-[11px]">{log.entityId || '—'}</td>
                      <td className="p-3 text-right">
                        <button type="button" onClick={() => setSelectedLog(log)} className="ml-auto inline-flex items-center gap-1 rounded border bg-background px-2.5 py-1.5 text-[10px] font-semibold hover:bg-accent">
                          <Eye className="h-3 w-3" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between gap-3">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || isFetching} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="text-[11px] text-muted-foreground">{logs.length ? ((page - 1) * PAGE_SIZE + 1) + '–' + ((page - 1) * PAGE_SIZE + logs.length) : '0'} of {total}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page >= totalPages || isFetching} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-40">
                Next <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}

        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
            <div className="w-full max-w-5xl rounded-2xl border bg-card p-5 shadow-2xl space-y-4 text-xs">
              <div className="flex items-start justify-between gap-3 border-b pb-3">
                <div>
                  <h2 className="text-sm font-bold">Audit event details</h2>
                  <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{selectedLog.id}</p>
                </div>
                <button type="button" onClick={() => setSelectedLog(null)} className="rounded-md p-1 hover:bg-accent" aria-label="Close details"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  ['Action', selectedLog.action],
                  ['Entity', selectedLog.entity],
                  ['Entity ID', selectedLog.entityId],
                  ['User ID', selectedLog.userId],
                  ['IP address', selectedLog.ipAddress],
                  ['Correlation ID', selectedLog.correlationId],
                  ['Timestamp', selectedLog.createdAt ? new Date(selectedLog.createdAt).toLocaleString('en-IN') : null],
                  ['Module', selectedLog.module],
                ].map(([label, value]) => (
                  <div key={String(label)} className="min-w-0 rounded-lg border p-3">
                    <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
                    <div className="mt-1 break-words font-semibold">{value == null || value === '' ? 'Not recorded' : String(value)}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <h3 className="font-bold uppercase text-[10px] text-red-600">Before state</h3>
                  <pre className="max-h-[55vh] overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-[10px]">{JSON.stringify(selectedLog.oldValue ?? null, null, 2)}</pre>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold uppercase text-[10px] text-emerald-600">After state</h3>
                  <pre className="max-h-[55vh] overflow-auto rounded-lg border bg-muted/20 p-3 font-mono text-[10px]">{JSON.stringify(selectedLog.newValue ?? null, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
