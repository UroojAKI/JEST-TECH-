'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Edit3,
  Trash2,
  UserCheck,
  Activity,
  Calendar,
  Info,
  ExternalLink,
} from 'lucide-react';
import {
  useAuditLogs,
  useAuditSummary,
  useAuditSessions,
  useAuditTimeline,
} from '../../../hooks/useAdmin';
import { adminRepository } from '../../../repositories/admin.repository';
import { toast } from 'sonner';
import Link from 'next/link';

type AuditTab = 'users' | 'timeline' | 'sessions' | 'raw';

export default function AuditCenterPage() {
  const [activeTab, setActiveTab] = useState<AuditTab>('users');

  // Filter states
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [timelineAction, setTimelineAction] = useState<string>('ALL');
  const [timelineEntity, setTimelineEntity] = useState<string>('ALL');
  const [timelinePage, setTimelinePage] = useState<number>(1);
  const [sessionsPage, setSessionsPage] = useState<number>(1);

  // Raw logs states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [rawActionFilter, setRawActionFilter] = useState<string>('ALL');
  const [rawEntityFilter, setRawEntityFilter] = useState<string>('ALL');
  const [rawPage, setRawPage] = useState<number>(1);
  const [rawLimit, setRawLimit] = useState<number>(50);

  // Modal inspection state
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setRawPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Data queries
  const { data: summaryData, isLoading: isSummaryLoading } = useAuditSummary();

  const { data: timelineResponse, isLoading: isTimelineLoading } = useAuditTimeline({
    userId: selectedUserId || undefined,
    action: timelineAction !== 'ALL' ? timelineAction : undefined,
    entity: timelineEntity !== 'ALL' ? timelineEntity : undefined,
    page: timelinePage,
    limit: 25,
  });

  const { data: sessionsResponse, isLoading: isSessionsLoading } = useAuditSessions({
    userId: selectedUserId || undefined,
    page: sessionsPage,
    limit: 20,
  });

  const { data: rawResponse, isLoading: isRawLoading } = useAuditLogs({
    search: debouncedQuery || undefined,
    action: rawActionFilter !== 'ALL' ? rawActionFilter : undefined,
    entity: rawEntityFilter !== 'ALL' ? rawEntityFilter : undefined,
    userId: selectedUserId || undefined,
    page: rawPage,
    limit: rawLimit,
  });

  const rawLogs: any[] = Array.isArray(rawResponse)
    ? rawResponse
    : ((rawResponse as any)?.data || []);

  const rawMeta = (rawResponse as any)?.meta || {
    page: rawPage,
    limit: rawLimit,
    total: rawLogs.length,
    totalPages: Math.ceil(rawLogs.length / rawLimit) || 1,
  };

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      setIsExporting(true);
      toast.info('Exporting authoritative audit trail logs...');
      const blob = await adminRepository.exportAuditLogs({
        format,
        search: debouncedQuery || undefined,
        action: rawActionFilter !== 'ALL' ? rawActionFilter : undefined,
        entity: rawEntityFilter !== 'ALL' ? rawEntityFilter : undefined,
        userId: selectedUserId || undefined,
      });

      const url = window.URL.createObjectURL(
        new Blob([blob], {
          type: format === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json',
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
      toast.error(err?.response?.data?.message || err.message || 'Audit export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const totals = summaryData?.totals || {
    totalEvents: 0,
    creates: 0,
    updates: 0,
    deletes: 0,
    approvals: 0,
    rejections: 0,
    logins: 0,
    logouts: 0,
  };

  const userBreakdown = summaryData?.userBreakdown || [];

  return (
    <AppShell activeWorkspace="ADMIN">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" /> Complete Admin Audit Dashboard (REQ-6)
            </h1>
            <p className="text-xs text-muted-foreground">
              User-wise activity monitoring, approval/rejection timeline, login/logout session duration, and immutable state diffs.
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

        {/* Global KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Total Events</span>
              <Activity className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-xl font-bold">{totals.totalEvents.toLocaleString()}</div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Created</span>
              <PlusCircle className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {totals.creates.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Edited / Saved</span>
              <Edit3 className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {totals.updates.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Deleted</span>
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </div>
            <div className="text-xl font-bold text-red-600 dark:text-red-400">
              {totals.deletes.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Approvals</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {totals.approvals.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>Rejections</span>
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
            </div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {totals.rejections.toLocaleString()}
            </div>
          </div>

          <div className="p-3.5 rounded-xl border bg-card shadow-xs space-y-1">
            <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium">
              <span>User Logins</span>
              <UserCheck className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-xl font-bold text-indigo-600 dark:text-indigo-400">
              {totals.logins.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-border gap-2">
          <div className="flex space-x-6 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('users')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="h-4 w-4" />
              <span>User Activity Breakdown</span>
            </button>

            <button
              onClick={() => setActiveTab('timeline')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'timeline'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Activity className="h-4 w-4" />
              <span>User Activity Timeline</span>
            </button>

            <button
              onClick={() => setActiveTab('sessions')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'sessions'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Login / Logout & Session Duration</span>
            </button>

            <button
              onClick={() => setActiveTab('raw')}
              className={`pb-2.5 flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === 'raw'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileCode className="h-4 w-4" />
              <span>System Audit Trail & State Diff</span>
            </button>
          </div>

          <Link
            href="/admin/audit-reports"
            className="pb-2 text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Policy Audit Reports &rarr;</span>
          </Link>
        </div>

        {/* Active User Filter Chip if selected */}
        {selectedUserId && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium">
            <span>Filtered for User ID: <span className="font-mono font-bold">{selectedUserId}</span></span>
            <button
              onClick={() => setSelectedUserId('')}
              className="p-0.5 rounded hover:bg-primary/20 ml-auto inline-flex items-center gap-1 text-[11px]"
            >
              <X className="h-3 w-3" /> Clear user filter
            </button>
          </div>
        )}

        {/* ── TAB 1: USER ACTIVITY BREAKDOWN ────────────────────────────── */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                    <th className="p-3">User / Employee</th>
                    <th className="p-3">Role</th>
                    <th className="p-3 text-center">Created</th>
                    <th className="p-3 text-center">Edited / Saved</th>
                    <th className="p-3 text-center">Deleted</th>
                    <th className="p-3 text-center">Approved</th>
                    <th className="p-3 text-center">Rejected</th>
                    <th className="p-3 text-center">Logins</th>
                    <th className="p-3 text-right">Total Actions</th>
                    <th className="p-3">Last Active</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isSummaryLoading ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Aggregating user activity metrics...</span>
                        </div>
                      </td>
                    </tr>
                  ) : userBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-muted-foreground">
                        No user activity recorded yet.
                      </td>
                    </tr>
                  ) : (
                    userBreakdown.map((u) => (
                      <tr key={u.userId} className="hover:bg-accent/40 transition">
                        <td className="p-3 font-semibold">
                          <div>{u.userName}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border">
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 text-center font-bold text-blue-600 dark:text-blue-400">
                          {u.creates > 0 ? u.creates : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                          {u.updates > 0 ? u.updates : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-red-600 dark:text-red-400">
                          {u.deletes > 0 ? u.deletes : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {u.approvals > 0 ? u.approvals : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-rose-600 dark:text-rose-400">
                          {u.rejections > 0 ? u.rejections : '-'}
                        </td>
                        <td className="p-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                          {u.logins > 0 ? u.logins : '-'}
                        </td>
                        <td className="p-3 text-right font-bold text-foreground">
                          {u.totalActions.toLocaleString()}
                        </td>
                        <td className="p-3 text-muted-foreground text-[11px] font-mono whitespace-nowrap">
                          {u.lastActive ? new Date(u.lastActive).toLocaleString('en-IN') : 'Never'}
                        </td>
                        <td className="p-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedUserId(u.userId);
                              setActiveTab('timeline');
                            }}
                            className="px-2 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                          >
                            Timeline
                          </button>
                          <button
                            onClick={() => {
                              setSelectedUserId(u.userId);
                              setActiveTab('sessions');
                            }}
                            className="px-2 py-1 rounded border bg-background hover:bg-accent font-semibold text-[10px]"
                          >
                            Sessions
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 2: USER ACTIVITY TIMELINE ─────────────────────────────── */}
        {activeTab === 'timeline' && (
          <div className="space-y-4">
            {/* Timeline Filter Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Filter by User
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    setSelectedUserId(e.target.value);
                    setTimelinePage(1);
                  }}
                  className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
                >
                  <option value="">All Users</option>
                  {userBreakdown.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.userName} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Action Type
                </label>
                <select
                  value={timelineAction}
                  onChange={(e) => {
                    setTimelineAction(e.target.value);
                    setTimelinePage(1);
                  }}
                  className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
                >
                  <option value="ALL">All Actions</option>
                  <option value="CREATE">CREATE</option>
                  <option value="UPDATE">UPDATE</option>
                  <option value="DELETE">DELETE</option>
                  <option value="APPROVE">APPROVE</option>
                  <option value="REJECT">REJECT</option>
                  <option value="LOGIN">LOGIN</option>
                  <option value="LOGOUT">LOGOUT</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">
                  Entity
                </label>
                <select
                  value={timelineEntity}
                  onChange={(e) => {
                    setTimelineEntity(e.target.value);
                    setTimelinePage(1);
                  }}
                  className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
                >
                  <option value="ALL">All Entities</option>
                  <option value="Policy">Policy</option>
                  <option value="Quotation">Quotation</option>
                  <option value="Customer">Customer</option>
                  <option value="Contact">Contact</option>
                  <option value="User">User</option>
                  <option value="MotorInspection">MotorInspection</option>
                </select>
              </div>
            </div>

            {/* Timeline Events List */}
            <div className="border rounded-xl bg-card p-4 shadow-xs space-y-3">
              {isTimelineLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span>Loading user activity timeline...</span>
                  </div>
                </div>
              ) : !timelineResponse?.data || timelineResponse.data.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs">
                  No activity events found matching the selected filters.
                </div>
              ) : (
                <div className="relative border-l-2 border-border ml-3 pl-4 space-y-4">
                  {timelineResponse.data.map((item: any) => {
                    const isApprove = item.action === 'APPROVE';
                    const isReject = item.action === 'REJECT';
                    const isCreate = item.action === 'CREATE';
                    const isDelete = item.action === 'DELETE';
                    const isLogin = item.action === 'LOGIN';
                    const isLogout = item.action === 'LOGOUT';

                    return (
                      <div key={item.id} className="relative group">
                        {/* Timeline Icon Node */}
                        <div
                          className={`absolute -left-[25px] top-1 h-5 w-5 rounded-full border flex items-center justify-center bg-card shadow-xs ${
                            isApprove
                              ? 'border-emerald-500 text-emerald-600'
                              : isReject
                                ? 'border-rose-500 text-rose-600'
                                : isCreate
                                  ? 'border-blue-500 text-blue-600'
                                  : isDelete
                                    ? 'border-red-500 text-red-600'
                                    : isLogin || isLogout
                                      ? 'border-indigo-500 text-indigo-600'
                                      : 'border-amber-500 text-amber-600'
                          }`}
                        >
                          {isApprove && <CheckCircle2 className="h-3 w-3" />}
                          {isReject && <XCircle className="h-3 w-3" />}
                          {isCreate && <PlusCircle className="h-3 w-3" />}
                          {isDelete && <Trash2 className="h-3 w-3" />}
                          {(isLogin || isLogout) && <Clock className="h-3 w-3" />}
                          {!isApprove && !isReject && !isCreate && !isDelete && !isLogin && !isLogout && (
                            <Edit3 className="h-3 w-3" />
                          )}
                        </div>

                        {/* Event Card */}
                        <div className="p-3 rounded-lg border bg-background/50 hover:bg-accent/40 transition space-y-1.5 text-xs">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>{item.description}</span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  isApprove
                                    ? 'bg-emerald-500/10 text-emerald-700'
                                    : isReject
                                      ? 'bg-rose-500/10 text-rose-700'
                                      : isCreate
                                        ? 'bg-blue-500/10 text-blue-700'
                                        : isDelete
                                          ? 'bg-red-500/10 text-red-700'
                                          : 'bg-muted text-muted-foreground'
                                }`}
                              >
                                {item.action}
                              </span>
                            </div>
                            <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                              {new Date(item.timestamp).toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
                            <span>Actor: <strong className="text-foreground">{item.user?.name}</strong> ({item.user?.role})</span>
                            {item.entityId && <span>Entity ID: {item.entityId}</span>}
                            {item.ipAddress && <span>IP: {item.ipAddress}</span>}
                            {item.hasDiff && (
                              <button
                                onClick={() => setSelectedLog(item)}
                                className="text-primary hover:underline font-sans font-semibold inline-flex items-center gap-1"
                              >
                                <Eye className="h-3 w-3" /> Inspect Change Diff
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Timeline Pagination */}
              {timelineResponse?.meta && timelineResponse.meta.totalPages > 1 && (
                <div className="pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Page {timelinePage} of {timelineResponse.meta.totalPages} ({timelineResponse.meta.total} total events)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTimelinePage((p) => Math.max(1, p - 1))}
                      disabled={timelinePage <= 1}
                      className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setTimelinePage((p) => Math.min(timelineResponse.meta.totalPages, p + 1))}
                      disabled={timelinePage >= timelineResponse.meta.totalPages}
                      className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: LOGIN/LOGOUT & SESSION DURATION ────────────────────── */}
        {activeTab === 'sessions' && (
          <div className="space-y-4">
            {/* Compliance Disclaimer Banner */}
            <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Regulatory & Audit Association Notice:</span>
                <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300">
                  {sessionsResponse?.disclaimer ||
                    'Audit session duration uses reliable login/logout session association intervals and does not indicate continuous employee active working time.'}
                </p>
              </div>
            </div>

            {/* Sessions Table */}
            <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                    <th className="p-3">Session ID</th>
                    <th className="p-3">User / Actor</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Login Time</th>
                    <th className="p-3">Logout Time</th>
                    <th className="p-3">Session Duration</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isSessionsLoading ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Calculating login/logout session intervals...</span>
                        </div>
                      </td>
                    </tr>
                  ) : !sessionsResponse?.data || sessionsResponse.data.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-muted-foreground">
                        No session records available.
                      </td>
                    </tr>
                  ) : (
                    sessionsResponse.data.map((sess: any) => (
                      <tr key={sess.sessionId} className="hover:bg-accent/40 transition">
                        <td className="p-3 font-mono font-bold text-primary">{sess.sessionId}</td>
                        <td className="p-3 font-semibold">
                          <div>{sess.user?.name}</div>
                          <div className="text-[10px] text-muted-foreground font-normal">{sess.user?.email}</div>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border">
                            {sess.user?.role}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {new Date(sess.loginTime).toLocaleString('en-IN')}
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {sess.logoutTime ? new Date(sess.logoutTime).toLocaleString('en-IN') : '-'}
                        </td>
                        <td className="p-3 font-bold text-foreground">
                          {sess.durationFormatted}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              sess.status === 'ENDED'
                                ? 'bg-muted text-muted-foreground'
                                : sess.status === 'ACTIVE'
                                  ? 'bg-emerald-500/10 text-emerald-700'
                                  : 'bg-amber-500/10 text-amber-700'
                            }`}
                          >
                            {sess.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[11px] text-muted-foreground">
                          {sess.ipAddress || 'Internal'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {/* Sessions Pagination */}
              {sessionsResponse?.meta && sessionsResponse.meta.totalPages > 1 && (
                <div className="p-3 border-t bg-muted/20 flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Page {sessionsPage} of {sessionsResponse.meta.totalPages} ({sessionsResponse.meta.total} total sessions)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                      disabled={sessionsPage <= 1}
                      className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSessionsPage((p) => Math.min(sessionsResponse.meta.totalPages, p + 1))}
                      disabled={sessionsPage >= sessionsResponse.meta.totalPages}
                      className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 4: SYSTEM AUDIT TRAIL & STATE DIFF ─────────────────────── */}
        {activeTab === 'raw' && (
          <div className="space-y-4">
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
                  value={rawActionFilter}
                  onChange={(e) => {
                    setRawActionFilter(e.target.value);
                    setRawPage(1);
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
                  <option value="APPROVE">APPROVE</option>
                  <option value="REJECT">REJECT</option>
                </select>
              </div>

              <div>
                <select
                  value={rawEntityFilter}
                  onChange={(e) => {
                    setRawEntityFilter(e.target.value);
                    setRawPage(1);
                  }}
                  className="w-full p-2 text-xs rounded-xl border bg-card text-foreground font-medium"
                >
                  <option value="ALL">All Entities</option>
                  <option value="Policy">Policy</option>
                  <option value="Quotation">Quotation</option>
                  <option value="Customer">Customer</option>
                  <option value="Contact">Contact</option>
                  <option value="User">User</option>
                  <option value="MotorInspection">MotorInspection</option>
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
                  {isRawLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span>Loading immutable audit logs...</span>
                        </div>
                      </td>
                    </tr>
                  ) : rawLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No audit records found matching query.
                      </td>
                    </tr>
                  ) : (
                    rawLogs.map((log: any) => (
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
                  Showing <span className="font-bold text-foreground">{rawLogs.length}</span> of{' '}
                  <span className="font-bold text-foreground">{rawMeta.total}</span> records
                  (Page <span className="font-bold text-foreground">{rawMeta.page}</span> of{' '}
                  <span className="font-bold text-foreground">{rawMeta.totalPages}</span>)
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={rawLimit}
                    onChange={(e) => {
                      setRawLimit(Number(e.target.value));
                      setRawPage(1);
                    }}
                    className="px-2 py-1 rounded-lg border bg-background text-foreground text-xs font-medium"
                  >
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>

                  <button
                    onClick={() => setRawPage((p) => Math.max(1, p - 1))}
                    disabled={rawPage <= 1}
                    className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 text-foreground"
                    title="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => setRawPage((p) => Math.min(rawMeta.totalPages, p + 1))}
                    disabled={rawPage >= rawMeta.totalPages}
                    className="p-1.5 rounded-lg border bg-background hover:bg-accent disabled:opacity-50 text-foreground"
                    title="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* JSON Diff Inspector Modal */}
        {selectedLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-3xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <h3 className="font-bold text-sm">Audit State Diff: {selectedLog.id}</h3>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    Correlation: {selectedLog.correlationId || 'N/A'}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedLog(null)}
                  className="p-1 rounded text-muted-foreground hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="font-bold text-red-500 uppercase text-[10px]">Before State</span>
                  <pre className="p-3 rounded-lg border bg-muted/20 font-mono text-[10px] overflow-x-auto text-red-600 dark:text-red-400 max-h-80 overflow-y-auto">
                    {JSON.stringify(
                      selectedLog.oldValue || selectedLog.beforeState || 'None (Created)',
                      null,
                      2,
                    )}
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
