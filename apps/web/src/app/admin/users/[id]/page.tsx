'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../components/ui/status-badge';
import { adminRepository, UserWorkspaceData } from '../../../../repositories/admin.repository';
import { apiClient } from '../../../../lib/api-client';
import { toast } from 'sonner';
import { useAuthStore } from '../../../../store/auth-store';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  Building2,
  Users,
  Shield,
  Briefcase,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Key,
  Lock,
  Unlock,
  Activity,
  CheckSquare,
  FileText,
  TrendingUp,
  Award,
  RefreshCw,
  Copy,
  Fingerprint,
  Plus,
} from 'lucide-react';

export default function User360Page() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const currentRole = currentUser?.role || currentUser?.roles?.[0];
  const canManageExternalCodes = currentRole === 'ADMIN' || currentRole === 'BACK_OFFICE';
  const canVerifyExternalCodes = currentRole === 'ADMIN';
  const userId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'activities' | 'tasks' | 'organization' | 'security' | 'finance' | 'identifiers'>('overview');
  const [externalCodeSearch, setExternalCodeSearch] = useState('');
  const [externalCodeStatusFilter, setExternalCodeStatusFilter] = useState('');
  const [externalCodeVerificationFilter, setExternalCodeVerificationFilter] = useState('');
  const [externalCodeHistoryId, setExternalCodeHistoryId] = useState<string | null>(null);
  const [externalCodeForm, setExternalCodeForm] = useState({
    externalCode: '', codeSystem: '', sourceName: '', isPrimary: false,
    effectiveFrom: '', effectiveTo: '', verificationNotes: '',
  });
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const { data: workspace, isLoading, error, refetch } = useQuery<UserWorkspaceData>({
    queryKey: ['admin', 'users', 'workspace', userId],
    queryFn: () => adminRepository.getUserWorkspace(userId),
    enabled: !!userId,
  });

  const {
    data: userCommissions = [],
    isLoading: isUserCommissionsLoading,
    isError: isUserCommissionsError,
    error: userCommissionsError,
  } = useQuery({
    queryKey: ['admin', 'users', userId, 'commissions'],
    queryFn: async () => {
      return adminRepository.getUserCommissions(userId);
    },
    enabled: !!userId,
  });

  const agentId = workspace?.profile.agentProfile?.id;
  const externalCodesQuery = useQuery({
    queryKey: ['agent-external-codes', agentId, externalCodeSearch, externalCodeStatusFilter, externalCodeVerificationFilter],
    queryFn: async () => (await apiClient.get(`/agents/${agentId}/external-codes`, {
      params: {
        limit: 100,
        search: externalCodeSearch.trim() || undefined,
        status: externalCodeStatusFilter || undefined,
        verificationStatus: externalCodeVerificationFilter || undefined,
      },
    })).data,
    enabled: activeTab === 'identifiers' && !!agentId,
  });

  const externalCodeHistoryQuery = useQuery({
    queryKey: ['agent-external-code-history', agentId, externalCodeHistoryId],
    queryFn: async () => (await apiClient.get(
      `/agents/${agentId}/external-codes/${externalCodeHistoryId}/history`,
      { params: { limit: 10 } },
    )).data,
    enabled: activeTab === 'identifiers' && !!agentId && !!externalCodeHistoryId,
  });

  const refreshExternalCodes = () => queryClient.invalidateQueries({
    queryKey: ['agent-external-codes', agentId],
  });

  const registerExternalCodeMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) throw new Error('Agent profile is not available');
      return apiClient.post(`/agents/${agentId}/external-codes`, {
        ...externalCodeForm,
        externalCode: externalCodeForm.externalCode.trim(),
        codeSystem: externalCodeForm.codeSystem.trim(),
        sourceName: externalCodeForm.sourceName.trim() || undefined,
        verificationNotes: externalCodeForm.verificationNotes.trim() || undefined,
        effectiveFrom: externalCodeForm.effectiveFrom || undefined,
        effectiveTo: externalCodeForm.effectiveTo || undefined,
      });
    },
    onSuccess: () => {
      toast.success('External identifier registered as pending verification');
      setExternalCodeForm({ externalCode: '', codeSystem: '', sourceName: '', isPrimary: false, effectiveFrom: '', effectiveTo: '', verificationNotes: '' });
      refreshExternalCodes();
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to register identifier'),
  });

  const updateExternalCodeMutation = useMutation({
    mutationFn: async ({ codeId, data }: { codeId: string; data: Record<string, unknown> }) => {
      if (!agentId) throw new Error('Agent profile is not available');
      return apiClient.patch(`/agents/${agentId}/external-codes/${codeId}`, data);
    },
    onSuccess: () => { toast.success('Identifier updated'); refreshExternalCodes(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update identifier'),
  });

  const toggleExternalCodeMutation = useMutation({
    mutationFn: async ({ codeId, action }: { codeId: string; action: 'deactivate' | 'reactivate' }) => {
      if (!agentId) throw new Error('Agent profile is not available');
      return apiClient.post(`/agents/${agentId}/external-codes/${codeId}/${action}`, {
        reason: `Updated from Agent profile for ${workspace?.profile.name || 'Agent'}`,
      });
    },
    onSuccess: () => { toast.success('Identifier status updated'); refreshExternalCodes(); },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Failed to update identifier status'),
  });

  const {
    data: userIncentives = [],
    isLoading: isUserIncentivesLoading,
    isError: isUserIncentivesError,
    error: userIncentivesError,
  } = useQuery({
    queryKey: ['admin', 'users', userId, 'incentives'],
    queryFn: async () => {
      return adminRepository.getUserIncentives(userId);
    },
    enabled: !!userId,
  });

  const lockMutation = useMutation({
    mutationFn: async ({ status }: { status: string }) => {
      return adminRepository.updateUserStatus(userId, status, 'Admin User 360 Status Update');
    },
    onSuccess: (_, vars) => {
      toast.success(`User successfully ${vars.status === 'LOCKED' ? 'locked' : 'unlocked'}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    },
  });

  const toggleCollectContactsMutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      return adminRepository.updateUser(userId, { collectContacts: newValue });
    },
    onSuccess: (_, newValue) => {
      toast.success(`Customer contact collection set to ${newValue ? 'REQUIRED' : 'OPTIONAL'}`);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      refetch();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update contact collection rule');
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (newPassword?: string) => {
      return adminRepository.resetUserPassword(userId, newPassword);
    },
    onSuccess: (data) => {
      if (data.newPassword) {
        setResetResult(data.newPassword);
      } else {
        toast.success('Password updated successfully');
        setResetModalOpen(false);
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading User 360 Workspace...</p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !workspace) {
    return (
      <AppShell>
        <div className="p-8 max-w-xl mx-auto text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold">User Not Found</h2>
          <p className="text-sm text-muted-foreground">
            The requested user workspace could not be loaded or access was denied.
          </p>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users
          </Link>
        </div>
      </AppShell>
    );
  }

  const {
    profile,
    portfolio,
    recentActivities = [],
    recentTasks = [],
    recentQuotations = [],
    recentPolicies = [],
    recentLeads = [],
    recentCustomers = [],
    recentRenewals = [],
    recentClaims = [],
  } = workspace;
  const isLocked = profile.status === 'LOCKED' || profile.status === 'SUSPENDED';

  const conversionRate = portfolio.leadsAssigned > 0
    ? ((portfolio.leadsConverted / portfolio.leadsAssigned) * 100).toFixed(1)
    : '0.0';

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Users Directory
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className="px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-accent flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* User 360 Header Card */}
        <div className="border rounded-2xl p-6 bg-card shadow-sm space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start md:items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                {profile.firstName[0]}
                {profile.lastName?.[0] || ''}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-muted border font-semibold">
                    {profile.employeeCode || 'EMP-UNKNOWN'}
                  </span>
                  <StatusBadge status={profile.status} />
                  {profile.role && (
                    <span className="px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-xs font-semibold">
                      {profile.role.name}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1 font-mono">
                    <Mail className="h-3.5 w-3.5" />
                    {profile.email}
                  </span>
                  {profile.phone && (
                    <span className="flex items-center gap-1 font-mono">
                      <Phone className="h-3.5 w-3.5" />
                      {profile.phone}
                    </span>
                  )}
                  {profile.branch && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" />
                      {profile.branch.name} ({profile.branch.code})
                    </span>
                  )}
                  {profile.team && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      {profile.team.name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => toggleCollectContactsMutation.mutate(!profile.collectContacts)}
                disabled={toggleCollectContactsMutation.isPending}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                  profile.collectContacts
                    ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300 hover:bg-emerald-500/20'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
                title="Toggle customer details collection requirement for quotation and lead workflows"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Contact Collection: {profile.collectContacts ? 'Enforced' : 'Optional'}
              </button>
              <button
                onClick={() => lockMutation.mutate({ status: isLocked ? 'ACTIVE' : 'LOCKED' })}
                disabled={lockMutation.isPending}
                className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                  isLocked
                    ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                }`}
              >
                {isLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                {isLocked ? 'Unlock Account' : 'Lock Account'}
              </button>
              <button
                onClick={() => {
                  setCustomPassword('');
                  setResetResult(null);
                  setResetModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg border bg-background text-foreground hover:bg-accent text-xs font-semibold flex items-center gap-1.5"
              >
                <Key className="h-3.5 w-3.5 text-amber-500" />
                Reset Password
              </button>
            </div>
          </div>

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-3 border-t">
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Assigned Leads</div>
              <div className="text-xl font-bold font-mono mt-0.5">{portfolio.leadsAssigned}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Converted Leads</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-emerald-600 flex items-baseline gap-1">
                {portfolio.leadsConverted}
                <span className="text-[10px] text-muted-foreground font-normal font-sans">({conversionRate}%)</span>
              </div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Quotes Created</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-primary">{portfolio.quotationsCreated ?? 0}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Policies Issued</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-indigo-600">{portfolio.policiesIssued ?? 0}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Quote Pipeline</div>
              <div
                className="text-lg font-bold font-mono mt-0.5 text-emerald-600 truncate"
                title={`₹${Number(portfolio.totalQuotationValue || 0).toLocaleString('en-IN')}`}
              >
                ₹{Number(portfolio.totalQuotationValue || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Issued Premium</div>
              <div
                className="text-lg font-bold font-mono mt-0.5 text-indigo-600 truncate"
                title={`₹${Number(portfolio.totalIssuedPremium || 0).toLocaleString('en-IN')}`}
              >
                ₹{Number(portfolio.totalIssuedPremium || 0).toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Managed Clients</div>
              <div className="text-xl font-bold font-mono mt-0.5">{portfolio.customersManaged}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Pending Tasks</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-amber-600">{portfolio.pendingTasks}</div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b text-sm font-medium gap-1 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'portfolio', label: 'Work Portfolio', icon: Briefcase },
            { id: 'activities', label: 'Activities & Audit', icon: Activity },
            { id: 'tasks', label: 'Tasks', icon: CheckSquare },
            { id: 'organization', label: 'Organization & Role', icon: Shield },
            { id: 'security', label: 'Security & Access', icon: Key },
            { id: 'finance', label: 'Commissions & Incentives', icon: Award },
            ...(profile.agentProfile ? [{ id: 'identifiers', label: 'Client codes', icon: Fingerprint }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'identifiers' && profile.agentProfile && (
          <section className="space-y-5">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.85fr)] gap-5">
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-bold flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> Client Agent codes</h2>
                    <p className="text-xs text-muted-foreground mt-1">Client-owned codes identify this Agent in your business records. A verified code is used for assignments; the database links records through the Agent profile.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={externalCodeStatusFilter}
                      onChange={(event) => setExternalCodeStatusFilter(event.target.value)}
                      className="rounded-lg border bg-background px-2.5 py-2 text-xs"
                      aria-label="Filter by identifier status"
                    >
                      <option value="">All statuses</option>
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                    <select
                      value={externalCodeVerificationFilter}
                      onChange={(event) => setExternalCodeVerificationFilter(event.target.value)}
                      className="rounded-lg border bg-background px-2.5 py-2 text-xs"
                      aria-label="Filter by verification status"
                    >
                      <option value="">All verification states</option>
                      <option value="PENDING">Pending</option>
                      <option value="VERIFIED">Verified</option>
                      <option value="REJECTED">Rejected</option>
                    </select>
                  </div>
                </div>
                <input
                  value={externalCodeSearch}
                  onChange={(event) => setExternalCodeSearch(event.target.value)}
                  placeholder="Search code, namespace, or source"
                  className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                />
                {externalCodesQuery.isLoading ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">Loading identifiers…</div>
                ) : externalCodesQuery.isError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Unable to load identifiers. Refresh or check access.</div>
                ) : (externalCodesQuery.data?.data || externalCodesQuery.data?.items || []).length === 0 ? (
                  <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No external identifiers registered.</div>
                ) : (
                  <div className="space-y-3">
                    {(externalCodesQuery.data?.data || externalCodesQuery.data?.items || []).map((code: any) => (
                      <article key={code.id} className="rounded-xl border p-4 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold">{code.externalCode}</span>
                              {code.isPrimary && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">PRIMARY</span>}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">{code.codeSystem}{code.sourceName ? ` · ${code.sourceName}` : ''}</div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="rounded-full border px-2 py-1">{code.status}</span>
                            <span className={`rounded-full border px-2 py-1 ${code.verificationStatus === 'VERIFIED' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' : ''}`}>{code.verificationStatus}</span>
                          </div>
                        </div>
                        {code.verificationNotes && <p className="text-xs text-muted-foreground">{code.verificationNotes}</p>}
                        {(code.effectiveFrom || code.effectiveTo) && <p className="text-[11px] text-muted-foreground">Effective {code.effectiveFrom ? new Date(code.effectiveFrom).toLocaleDateString() : 'from any date'} – {code.effectiveTo ? new Date(code.effectiveTo).toLocaleDateString() : 'open ended'}</p>}
                        <div className="flex flex-wrap gap-2 border-t pt-3">
                          {canVerifyExternalCodes && code.status === 'ACTIVE' && code.verificationStatus !== 'VERIFIED' && (
                            <button type="button" onClick={() => updateExternalCodeMutation.mutate({ codeId: code.id, data: { verificationStatus: 'VERIFIED', reason: 'Verified by Admin in Agent profile' } })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50" disabled={updateExternalCodeMutation.isPending}>Verify</button>
                          )}
                          {canVerifyExternalCodes && code.status === 'ACTIVE' && code.verificationStatus !== 'REJECTED' && (
                            <button type="button" onClick={() => updateExternalCodeMutation.mutate({ codeId: code.id, data: { verificationStatus: 'REJECTED', reason: 'Rejected by Admin in Agent profile' } })} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50" disabled={updateExternalCodeMutation.isPending}>Reject</button>
                          )}
                          {canManageExternalCodes && <button type="button" onClick={() => toggleExternalCodeMutation.mutate({ codeId: code.id, action: code.status === 'ACTIVE' ? 'deactivate' : 'reactivate' })} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent disabled:opacity-50" disabled={toggleExternalCodeMutation.isPending}>{code.status === 'ACTIVE' ? 'Deactivate' : 'Reactivate'}</button>}
                          <button type="button" onClick={() => setExternalCodeHistoryId(externalCodeHistoryId === code.id ? null : code.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-accent">{externalCodeHistoryId === code.id ? 'Hide history' : 'View history'}</button>
                        </div>
                        {externalCodeHistoryId === code.id && (
                          <div className="rounded-lg bg-muted/30 p-3 space-y-2">
                            {externalCodeHistoryQuery.isLoading ? <p className="text-xs text-muted-foreground">Loading history…</p> : null}
                            {(externalCodeHistoryQuery.data?.data || externalCodeHistoryQuery.data?.items || []).map((event: any) => (
                              <div key={event.id} className="flex flex-wrap justify-between gap-2 text-xs">
                                <span className="font-semibold">{event.action} · {event.changedBy?.firstName} {event.changedBy?.lastName}</span>
                                <span className="text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</span>
                                {event.reason && <span className="w-full text-muted-foreground">{event.reason}</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </div>

              {canManageExternalCodes ? <form onSubmit={(event) => { event.preventDefault(); registerExternalCodeMutation.mutate(); }} className="h-fit rounded-2xl border bg-card p-5 space-y-4">
                <div>
                  <h2 className="font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Add a client code</h2>
                  <p className="text-xs text-muted-foreground mt-1">Code casing and punctuation are preserved. Deactivated codes remain reserved.</p>
                </div>
                <label className="block space-y-1.5 text-xs font-semibold">Client Agent Code
                  <input required maxLength={100} value={externalCodeForm.externalCode} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, externalCode: event.target.value })} placeholder="IGSK001" className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold">Code System / Namespace
                  <input required maxLength={50} value={externalCodeForm.codeSystem} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, codeSystem: event.target.value.toUpperCase() })} placeholder="CLIENT_A" className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                </label>
                <label className="block space-y-1.5 text-xs font-semibold">Source
                  <input maxLength={100} value={externalCodeForm.sourceName} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, sourceName: event.target.value })} placeholder="Client agent master" className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1.5 text-xs font-semibold">Effective From
                    <input type="date" value={externalCodeForm.effectiveFrom} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, effectiveFrom: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block space-y-1.5 text-xs font-semibold">Effective To
                    <input type="date" value={externalCodeForm.effectiveTo.slice(0, 10)} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, effectiveTo: event.target.value ? `${event.target.value}T23:59:59.999Z` : '' })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                  </label>
                </div>
                <label className="block space-y-1.5 text-xs font-semibold">Verification Notes
                  <textarea maxLength={500} value={externalCodeForm.verificationNotes} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, verificationNotes: event.target.value })} placeholder="Optional source or verification context" className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" rows={2} />
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input type="checkbox" checked={externalCodeForm.isPrimary} onChange={(event) => setExternalCodeForm({ ...externalCodeForm, isPrimary: event.target.checked })} />
                  Primary code within this namespace
                </label>
                <button type="submit" disabled={registerExternalCodeMutation.isPending || !externalCodeForm.externalCode.trim() || !externalCodeForm.codeSystem.trim()} className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {registerExternalCodeMutation.isPending ? 'Registering…' : 'Add code for verification'}
                </button>
              </form> : <div className="h-fit rounded-2xl border bg-card p-5 text-sm text-muted-foreground">Identifier management is available to Admin and Back Office users.</div>}
            </div>
          </section>
        )}

        {/* Tab Content: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-2xl p-5 bg-card space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Profile Information
              </h2>
              <div className="divide-y text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Full Name</span>
                  <span className="font-semibold">{profile.name}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Employee Code</span>
                  <span className="font-mono font-bold text-primary">{profile.employeeCode || 'N/A'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Email Address</span>
                  <span className="font-mono">{profile.email}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Mobile Phone</span>
                  <span className="font-mono">{profile.phone || 'N/A'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Designation</span>
                  <span>{profile.designation || 'Staff'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>{profile.department || 'General Operations'}</span>
                </div>
              </div>
            </div>

            <div className="border rounded-2xl p-5 bg-card space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Organizational Placement
              </h2>
              <div className="divide-y text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Assigned Branch</span>
                  <span className="font-semibold">
                    {profile.branch ? `${profile.branch.name} (${profile.branch.code})` : 'Unassigned'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Branch City</span>
                  <span>{profile.branch?.city || 'N/A'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Team Unit</span>
                  <span>{profile.team?.name || 'Unassigned'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Agent Channel</span>
                  <span>
                    {profile.agentProfile ? (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 border border-emerald-300">
                        {(profile.agentProfile.clientCodes.find((code) => code.isPrimary && code.verificationStatus === 'VERIFIED') || profile.agentProfile.clientCodes.find((code) => code.verificationStatus === 'VERIFIED'))?.value || 'Client code not registered'} ({profile.agentProfile.commissionTier || 'STANDARD'})
                      </span>
                    ) : (
                      'Non-Agent User'
                    )}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Account Created</span>
                  <span className="font-mono text-xs">{new Date(profile.createdAt).toLocaleString()}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Last Login</span>
                  <span className="font-mono text-xs">
                    {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Never logged in'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Overview Operational KPI Cards */}
            <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  <span>Quotes Created</span>
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="text-2xl font-bold font-mono text-primary">{portfolio.quotationsCreated ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Pipeline: <span className="font-mono font-bold text-emerald-600">₹{Number(portfolio.totalQuotationValue || 0).toLocaleString('en-IN')}</span></div>
              </div>
              <div className="p-4 bg-indigo-500/5 border border-indigo-500/20 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  <span>Policies Issued</span>
                  <Award className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-indigo-600">{portfolio.policiesIssued ?? 0}</div>
                <div className="text-[11px] text-muted-foreground">Gross Premium: <span className="font-mono font-bold text-indigo-600">₹{Number(portfolio.totalIssuedPremium || 0).toLocaleString('en-IN')}</span></div>
              </div>
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  <span>Converted Leads</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-emerald-600">{portfolio.leadsConverted}</div>
                <div className="text-[11px] text-muted-foreground">Rate: <span className="font-mono font-bold">{conversionRate}%</span> of {portfolio.leadsAssigned} assigned</div>
              </div>
              <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-1">
                <div className="text-xs text-muted-foreground font-medium flex items-center justify-between">
                  <span>Managed Clients</span>
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-amber-600">{portfolio.customersManaged}</div>
                <div className="text-[11px] text-muted-foreground">Pending Tasks: <span className="font-mono font-bold text-amber-600">{portfolio.pendingTasks}</span></div>
              </div>
            </div>

            {/* Overview Quotations & Activity Strip */}
            <div className="md:col-span-2 space-y-6 pt-2">
              {/* Recent Quotations Table */}
              <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      User Quotations & Prices ({recentQuotations.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">All quotations created, pricing breakdown, and issuance progression</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('portfolio')}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    View All in Portfolio →
                  </button>
                </div>
                {recentQuotations.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No quotations recorded for this user yet.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                          <th className="p-3">Quotation Code</th>
                          <th className="p-3">Customer</th>
                          <th className="p-3">Insurer & Product</th>
                          <th className="p-3">Total Premium (Price)</th>
                          <th className="p-3">Quote Status</th>
                          <th className="p-3">Issuance Status</th>
                          <th className="p-3">Policy Number</th>
                          <th className="p-3">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {recentQuotations.slice(0, 10).map((q) => (
                          <tr key={q.id} className="hover:bg-accent/40 font-sans">
                            <td className="p-3 font-mono font-bold text-primary">{q.quotationCode}</td>
                            <td className="p-3">
                              <div className="font-semibold text-foreground">{q.customerName}</div>
                              {q.customerPhone && <div className="text-[11px] text-muted-foreground font-mono">{q.customerPhone}</div>}
                            </td>
                            <td className="p-3">
                              <div className="font-semibold">{q.insurerName}</div>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{q.productType}</span>
                            </td>
                            <td className="p-3 font-mono text-sm font-bold text-emerald-600">
                              ₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}
                            </td>
                            <td className="p-3"><StatusBadge status={q.status} /></td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                q.issuanceStatus === 'ISSUED'
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
                                  : q.issuanceStatus === 'PAYMENT_PENDING' || q.issuanceStatus === 'ISSUANCE_PENDING'
                                  ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}>
                                {q.issuanceStatus || 'DRAFT'}
                              </span>
                            </td>
                            <td className="p-3 font-mono">
                              {q.policyNumber ? <span className="text-indigo-600 font-bold">{q.policyNumber}</span> : <span className="text-muted-foreground">-</span>}
                            </td>
                            <td className="p-3 font-mono text-[11px] text-muted-foreground">{new Date(q.createdAt).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* User Activity & Audit Timeline */}
              <div className="border rounded-2xl overflow-hidden bg-card shadow-sm">
                <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" />
                      Recent User Activity & Operations ({recentActivities.length})
                    </h3>
                    <p className="text-xs text-muted-foreground">Live operational stream of quotations, policy issuances, and user events</p>
                  </div>
                  <button
                    onClick={() => setActiveTab('activities')}
                    className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                  >
                    View All Audit Logs →
                  </button>
                </div>
                {recentActivities.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No recent activity recorded for this user.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                          <th className="p-3">Type</th>
                          <th className="p-3">Action</th>
                          <th className="p-3">Entity</th>
                          <th className="p-3">Reference / Code</th>
                          <th className="p-3">Details & Pricing</th>
                          <th className="p-3">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {recentActivities.slice(0, 10).map((act) => {
                          const isOperational = act.source === 'OPERATIONAL';
                          return (
                            <tr key={act.id} className="hover:bg-accent/40">
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isOperational
                                    ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300'
                                    : 'bg-muted text-muted-foreground border border-border'
                                }`}>
                                  {act.source}
                                </span>
                              </td>
                              <td className="p-3 font-semibold">{act.action}</td>
                              <td className="p-3 font-mono text-[11px]">{act.entity}</td>
                              <td className="p-3 font-mono font-bold text-primary">{act.entityId || '-'}</td>
                              <td className="p-3 max-w-xs truncate text-[11px] text-muted-foreground">
                                {typeof act.details === 'object' ? JSON.stringify(act.details) : act.details || '-'}
                              </td>
                              <td className="p-3 font-mono text-[11px] text-muted-foreground">{new Date(act.createdAt).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: WORK PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {/* Top Portfolio Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Quotations & Pipeline */}
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Quotations & Pipeline</span>
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="text-3xl font-bold font-mono text-primary">
                  {portfolio.quotationsCreated ?? 0}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Approved Quotes:</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {portfolio.quotationsApproved ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Issued / Converted:</span>
                    <span className="font-mono font-semibold text-indigo-600">
                      {portfolio.quotationsIssued ?? 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-1 border-t">
                    <span>Total Pipeline Value:</span>
                    <span className="font-mono text-emerald-600">
                      ₹{Number(portfolio.totalQuotationValue || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Policies & Written Premium */}
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Policies & Premium</span>
                  <Award className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-bold font-mono text-indigo-600">
                  {portfolio.policiesIssued ?? 0}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Active Policies:</span>
                    <span className="font-mono font-semibold">{portfolio.policiesIssued ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Upcoming Renewals (30d):</span>
                    <span className="font-mono">{portfolio.renewalsPending ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-foreground font-semibold pt-1 border-t">
                    <span>Gross Issued Premium:</span>
                    <span className="font-mono text-indigo-600">
                      ₹{Number(portfolio.totalIssuedPremium || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Leads Lifecycle */}
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Leads Lifecycle</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-bold font-mono">{portfolio.leadsAssigned}</div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Created by User:</span>
                    <span className="font-mono font-semibold">{portfolio.leadsCreated}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Converted ({conversionRate}%):</span>
                    <span className="font-mono">{portfolio.leadsConverted}</span>
                  </div>
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Lost / Dropped:</span>
                    <span className="font-mono">{portfolio.leadsLost}</span>
                  </div>
                </div>
              </div>

              {/* Client Base & Workload */}
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Client Base & Tasks</span>
                  <Users className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-600">
                  {portfolio.customersManaged}
                </div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Customers Created:</span>
                    <span className="font-mono font-semibold">{portfolio.customersCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contacts Authored:</span>
                    <span className="font-mono font-semibold">{portfolio.contactsCreated}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-semibold pt-1 border-t">
                    <span>Pending Tasks ({portfolio.overdueTasks} Overdue):</span>
                    <span className="font-mono">{portfolio.pendingTasks}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quotations Register Table */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    Quotations Created & Managed ({recentQuotations.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Quotes prepared by this user, including pricing, insurer selection, and issuance progression
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-300">
                  Pipeline: ₹{Number(portfolio.totalQuotationValue || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {recentQuotations.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No quotations have been created by or assigned to this user.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Quotation Code</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Insurer & Product</th>
                        <th className="p-3">Total Premium (Price)</th>
                        <th className="p-3">Quote Status</th>
                        <th className="p-3">Issuance Status</th>
                        <th className="p-3">Issued Policy</th>
                        <th className="p-3">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentQuotations.map((q) => (
                        <tr key={q.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-primary">
                            {q.quotationCode}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{q.customerName}</div>
                            {q.customerPhone && (
                              <div className="text-[11px] text-muted-foreground font-mono">{q.customerPhone}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{q.insurerName}</div>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {q.productType}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-sm font-bold text-emerald-600">
                            ₹{Number(q.totalPremium || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={q.status} />
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                q.issuanceStatus === 'ISSUED'
                                  ? 'bg-emerald-500/10 text-emerald-700 border-emerald-300'
                                  : q.issuanceStatus === 'PAYMENT_PENDING' || q.issuanceStatus === 'ISSUANCE_PENDING'
                                  ? 'bg-amber-500/10 text-amber-700 border-amber-300'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              {q.issuanceStatus || 'DRAFT'}
                            </span>
                          </td>
                          <td className="p-3 font-mono">
                            {q.policyNumber ? (
                              <span className="text-indigo-600 font-bold">{q.policyNumber}</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(q.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Issued Policies Register Table */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-indigo-600" />
                    Issued Policies & Premium ({recentPolicies.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Active and issued policies credited to this agent with gross premium figures
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-indigo-600 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-300">
                  Gross Premium: ₹{Number(portfolio.totalIssuedPremium || 0).toLocaleString('en-IN')}
                </span>
              </div>
              {recentPolicies.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No policies have been issued under this user yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Policy Number</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Insurer & Product</th>
                        <th className="p-3">Gross Premium</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Validity</th>
                        <th className="p-3">Issued Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentPolicies.map((p) => (
                        <tr key={p.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-indigo-600">
                            {p.policyNumber}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{p.customerName}</div>
                            {p.customerPhone && (
                              <div className="text-[11px] text-muted-foreground font-mono">{p.customerPhone}</div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-semibold">{p.insurerName}</div>
                            {p.productType && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {p.productType}
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-sm font-bold text-indigo-600">
                            ₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {p.effectiveDate ? new Date(p.effectiveDate).toLocaleDateString() : 'N/A'} -{' '}
                            {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(p.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Leads Pipeline Table */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    Assigned & Converted Leads ({recentLeads.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Leads assigned to this user and current conversion progression
                  </p>
                </div>
                <span className="text-xs font-semibold text-muted-foreground">
                  Conversion Rate: {conversionRate}% ({portfolio.leadsConverted}/{portfolio.leadsAssigned || 1})
                </span>
              </div>
              {recentLeads.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No active or historical leads assigned to this user.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Lead Code</th>
                        <th className="p-3">Customer / Contact</th>
                        <th className="p-3">Workflow Stage</th>
                        <th className="p-3">Est. Premium</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Created Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentLeads.map((l) => (
                        <tr key={l.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-primary">
                            {l.leadCode || 'LEAD'}
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {l.customerName}
                          </td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                              {l.currentWorkflowStep || 'INITIAL_CONTACT'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-sm font-bold text-emerald-600">
                            {l.estimatedPremium ? `₹${Number(l.estimatedPremium).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={l.status} />
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(l.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Customer Portfolio Table */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Assigned Customer Portfolio ({recentCustomers.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Directly managed customers, account relationships, and total gross written premium
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-600 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-300">
                  {recentCustomers.length} Accounts
                </span>
              </div>
              {recentCustomers.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No customers are currently assigned to this agent.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Customer Code</th>
                        <th className="p-3">Customer Name</th>
                        <th className="p-3">Phone</th>
                        <th className="p-3">Email</th>
                        <th className="p-3">Active Policies</th>
                        <th className="p-3">Total GWP</th>
                        <th className="p-3">Joined Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentCustomers.map((c: any) => (
                        <tr key={c.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-primary">
                            <Link href={`/crm/customers/${c.id}`} className="hover:underline">
                              {c.customerCode}
                            </Link>
                          </td>
                          <td className="p-3 font-semibold text-foreground">{c.name}</td>
                          <td className="p-3 font-mono text-muted-foreground">{c.phone || '-'}</td>
                          <td className="p-3 text-muted-foreground">{c.email || '-'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                              {c.activePoliciesCount} {c.activePoliciesCount === 1 ? 'Policy' : 'Policies'}
                            </span>
                          </td>
                          <td className="p-3 font-mono text-sm font-bold text-emerald-600">
                            ₹{Number(c.totalGwp || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(c.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Upcoming Renewals Pipeline */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    Renewals Pipeline & Expiries ({recentRenewals.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Policies approaching expiry requiring agent renewal follow-up and retention actions
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-amber-600 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-300">
                  {recentRenewals.filter((r: any) => r.daysToExpiry <= 30 && r.daysToExpiry >= 0).length} Due in 30 Days
                </span>
              </div>
              {recentRenewals.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No upcoming policy renewals within the next 60 days.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Policy Number</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Insurer</th>
                        <th className="p-3">Premium</th>
                        <th className="p-3">Expiry Date</th>
                        <th className="p-3">Days Remaining</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentRenewals.map((r: any) => (
                        <tr key={r.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-primary">
                            <Link href={`/policies/${r.id}`} className="hover:underline">
                              {r.policyNumber}
                            </Link>
                          </td>
                          <td className="p-3 font-semibold text-foreground">{r.customerName}</td>
                          <td className="p-3">{r.insurerName}</td>
                          <td className="p-3 font-mono text-sm font-bold text-foreground">
                            ₹{Number(r.premiumAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(r.expiryDate).toLocaleDateString()}
                          </td>
                          <td className="p-3 font-mono font-bold">
                            <span className={
                              r.daysToExpiry < 0
                                ? 'text-rose-600'
                                : r.daysToExpiry <= 15
                                ? 'text-amber-600'
                                : 'text-emerald-600'
                            }>
                              {r.daysToExpiry < 0 ? `Lapsed (${Math.abs(r.daysToExpiry)}d ago)` : `${r.daysToExpiry} days`}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={
                              r.status === 'LAPSED'
                                ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600'
                                : r.status === 'CRITICAL'
                                ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600'
                                : 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600'
                            }>
                              {r.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Claims Visibility Table */}
            <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
              <div className="p-4 border-b flex items-center justify-between bg-muted/20">
                <div className="space-y-0.5">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-primary" />
                    Claims Visibility ({recentClaims.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Claims registered on policies written by or attributed to this agent
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-foreground px-2.5 py-1 rounded-lg bg-muted border">
                  Total Claims: {recentClaims.length}
                </span>
              </div>
              {recentClaims.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  No claims have been registered on this agent's policies.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                        <th className="p-3">Claim Number</th>
                        <th className="p-3">Policy Number</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Claim Amount</th>
                        <th className="p-3">Settled Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Reported Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {recentClaims.map((cl: any) => (
                        <tr key={cl.id} className="hover:bg-accent/40 font-sans">
                          <td className="p-3 font-mono font-bold text-primary">{cl.claimNumber}</td>
                          <td className="p-3 font-mono text-foreground">{cl.policyNumber}</td>
                          <td className="p-3 font-semibold text-foreground">{cl.customerName}</td>
                          <td className="p-3 font-mono text-sm font-bold text-foreground">
                            ₹{Number(cl.claimAmount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 font-mono text-sm font-bold text-emerald-600">
                            {cl.settledAmount ? `₹${Number(cl.settledAmount).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-3">
                            <StatusBadge status={cl.status} />
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {new Date(cl.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: ACTIVITIES & AUDIT */}
        {activeTab === 'activities' && (
          <div className="border rounded-2xl overflow-hidden bg-card shadow-sm space-y-0">
            <div className="p-4 border-b flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <h2 className="text-sm font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  User Activity & Audit Trail ({recentActivities.length} Events)
                </h2>
                <p className="text-xs text-muted-foreground">
                  Comprehensive chronological feed of business operations (quotes created, policies issued) and security events
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-muted-foreground">
                All Recorded Events
              </span>
            </div>
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No activity logs or business transactions recorded for this user account.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                      <th className="p-3">Type</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Reference / Code</th>
                      <th className="p-3">Details & Pricing</th>
                      <th className="p-3">Source / IP</th>
                      <th className="p-3">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentActivities.map((act) => {
                      const isOperational = act.source === 'OPERATIONAL';
                      return (
                        <tr key={act.id} className="hover:bg-accent/40">
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isOperational
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300'
                                  : 'bg-muted text-muted-foreground border border-border'
                              }`}
                            >
                              {isOperational ? 'BUSINESS' : 'SECURITY'}
                            </span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                act.action === 'ISSUE'
                                  ? 'bg-indigo-500/10 text-indigo-700 border border-indigo-300'
                                  : act.action === 'CONVERT'
                                  ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-300'
                                  : act.action === 'CREATE'
                                  ? 'bg-blue-500/10 text-blue-700 border border-blue-300'
                                  : act.action === 'UPDATE'
                                  ? 'bg-amber-500/10 text-amber-700 border border-amber-300'
                                  : act.action === 'DELETE' || act.action === 'LOCK'
                                  ? 'bg-rose-500/10 text-rose-700 border border-rose-300'
                                  : 'bg-primary/10 text-primary border border-primary/20'
                              }`}
                            >
                              {act.action}
                            </span>
                          </td>
                          <td className="p-3 font-semibold text-foreground">
                            {act.entity}
                          </td>
                          <td className="p-3 font-mono font-bold text-primary">
                            {act.entityId}
                          </td>
                          <td className="p-3 text-xs">
                            {typeof act.details === 'object' && act.details !== null ? (
                              <div className="space-y-0.5">
                                {act.details.customer && (
                                  <div>
                                    <span className="text-muted-foreground">Client: </span>
                                    <span className="font-semibold">{act.details.customer}</span>
                                  </div>
                                )}
                                {act.details.insurer && (
                                  <div>
                                    <span className="text-muted-foreground">Insurer: </span>
                                    <span>{act.details.insurer}</span>
                                  </div>
                                )}
                                {act.details.premium && (
                                  <div>
                                    <span className="text-muted-foreground">Premium: </span>
                                    <span className="font-mono font-bold text-emerald-600">{act.details.premium}</span>
                                  </div>
                                )}
                                {act.details.status && (
                                  <div>
                                    <span className="text-muted-foreground">Status: </span>
                                    <span className="font-semibold">{act.details.status}</span>
                                    {act.details.issuanceStatus && (
                                      <span className="ml-1 text-[10px] px-1 py-0.2 bg-muted rounded">
                                        ({act.details.issuanceStatus})
                                      </span>
                                    )}
                                  </div>
                                )}
                                {!act.details.customer && !act.details.premium && (
                                  <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[280px] block">
                                    {JSON.stringify(act.details)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">{act.details || '-'}</span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground">
                            {act.ipAddress || '127.0.0.1'}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                            {new Date(act.createdAt).toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab Content: TASKS */}
        {activeTab === 'tasks' && (
          <div className="border rounded-2xl overflow-hidden bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                Active Assigned Tasks ({recentTasks.length})
              </h2>
            </div>
            {recentTasks.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No assigned tasks currently pending for this user.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                    <th className="p-3">Title</th>
                    <th className="p-3">Priority</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Due Date</th>
                    <th className="p-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recentTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-accent/40">
                      <td className="p-3 font-semibold">{t.title}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          t.priority === 'HIGH' || t.priority === 'URGENT'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-300'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="p-3">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No due date'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab Content: ORGANIZATION & PERMISSIONS */}
        {activeTab === 'organization' && (
          <div className="space-y-6">
            <div className="border rounded-2xl p-5 bg-card space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Assigned Role & Authorization Scope
              </h2>
              {profile.role ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1 rounded-lg bg-primary/10 text-primary font-bold text-sm border border-primary/20">
                      {profile.role.name} ({profile.role.code})
                    </div>
                    <span className="text-xs text-muted-foreground font-mono">
                      System Type: {profile.role.type}
                    </span>
                  </div>
                  {profile.role.description && (
                    <p className="text-xs text-muted-foreground">{profile.role.description}</p>
                  )}

                  <div className="pt-3 border-t">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                      Granted Permissions ({profile.role.permissions.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {profile.role.permissions.map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 rounded-lg border bg-muted/20 flex flex-col gap-1 text-xs"
                        >
                          <div className="font-semibold flex items-center justify-between">
                            <span>{p.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {p.scope}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-primary">{p.code}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No specific role permissions configured.</p>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: SECURITY & ACCESS */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border rounded-2xl p-5 bg-card space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                Authentication & Account Security
              </h2>
              <div className="divide-y text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Account Status</span>
                  <StatusBadge status={profile.status} />
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Lock Status</span>
                  <span className={`font-semibold ${isLocked ? 'text-rose-500' : 'text-emerald-600'}`}>
                    {isLocked ? 'Account is Locked' : 'Active / Unlocked'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Last Login Timestamp</span>
                  <span className="font-mono text-xs">
                    {profile.lastLoginAt ? new Date(profile.lastLoginAt).toLocaleString() : 'Never'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-muted-foreground">Customer Contacts Rule</span>
                  <span className={`font-semibold ${profile.collectContacts ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                    {profile.collectContacts ? 'Strictly Enforced' : 'Optional Workflows'}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t flex gap-2">
                <button
                  onClick={() => lockMutation.mutate({ status: isLocked ? 'ACTIVE' : 'LOCKED' })}
                  disabled={lockMutation.isPending}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-1.5 ${
                    isLocked
                      ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                      : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
                  }`}
                >
                  {isLocked ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                  {isLocked ? 'Unlock Account' : 'Lock Account'}
                </button>
                <button
                  onClick={() => {
                    setCustomPassword('');
                    setResetResult(null);
                    setResetModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-lg border bg-background hover:bg-accent text-xs font-semibold flex items-center gap-1.5"
                >
                  <Key className="h-4 w-4 text-amber-500" />
                  Reset Credentials
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: COMMISSIONS & INCENTIVES */}
        {activeTab === 'finance' && (
          <div className="space-y-6">
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Commission Accrued</span>
                  <Award className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black font-mono text-emerald-600">
                  ₹{userCommissions.reduce((sum: number, c: any) => sum + Number(c.amount || c.commissionAmount || 0), 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Total commission records generated
                </div>
              </div>

              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Approved for Payout</span>
                  <Award className="h-4 w-4 text-blue-500" />
                </div>
                <div className="text-2xl font-black font-mono text-primary">
                  ₹{userCommissions.filter((c: any) => c.status === 'APPROVED' || c.payoutStatus === 'APPROVED').reduce((sum: number, c: any) => sum + Number(c.amount || c.commissionAmount || 0), 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Verified by Accounts & Finance
                </div>
              </div>

              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Disbursed / Paid</span>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-black font-mono text-foreground">
                  ₹{userCommissions.filter((c: any) => c.status === 'PAID' || c.payoutStatus === 'PAID').reduce((sum: number, c: any) => sum + Number(c.amount || c.commissionAmount || 0), 0).toLocaleString('en-IN')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Bank transfer confirmed
                </div>
              </div>
            </div>

            {/* Commissions Register */}
            <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-bold flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  Commission History & Status
                </h2>
                <span className="text-xs text-muted-foreground font-semibold">
                  {userCommissions.length} Record(s) Found
                </span>
              </div>

              {isUserCommissionsLoading ? (
                <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading commissions...
                </div>
              ) : isUserCommissionsError ? (
                <div className="p-8 text-center text-destructive text-xs border rounded-xl bg-destructive/10 space-y-1">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <p className="font-semibold">
                    {(userCommissionsError as any)?.response?.status === 403
                      ? 'Unauthorized: You do not have permission to view this employee’s financial records.'
                      : 'Failed to load employee commissions. Please try again later.'}
                  </p>
                </div>
              ) : userCommissions.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs border rounded-xl bg-accent/20">
                  No commission entries found for this employee in the current company context.
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                        <th className="p-3">Policy No.</th>
                        <th className="p-3">Customer</th>
                        <th className="p-3">Role Tier</th>
                        <th className="p-3">Gross Premium</th>
                        <th className="p-3">Earned Amount</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Payout Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {userCommissions.map((c: any) => (
                        <tr key={c.id} className="hover:bg-accent/40">
                          <td className="p-3 font-mono font-bold text-primary">{c.policyNumber}</td>
                          <td className="p-3 font-semibold">{c.customerName}</td>
                          <td className="p-3"><span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold">{c.roleTier || 'AGENT'}</span></td>
                          <td className="p-3 font-mono">₹{Number(c.grossPremium || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3 font-mono font-bold text-emerald-600">₹{Number(c.amount || c.commissionAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-3"><StatusBadge status={c.status} /></td>
                          <td className="p-3"><StatusBadge status={c.payoutStatus} /></td>
                          <td className="p-3 font-mono text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Incentives Section */}
            <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" />
                    Performance Targets & Incentives
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Target benchmarks and achievements. Incentive formula is pending executive business approval (INC-B01).
                  </p>
                </div>
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-700 border border-amber-500/20">
                  Policy Pending (INC-B01)
                </span>
              </div>

              {isUserIncentivesLoading ? (
                <div className="p-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-primary" /> Loading targets...
                </div>
              ) : isUserIncentivesError ? (
                <div className="p-8 text-center text-destructive text-xs border rounded-xl bg-destructive/10 space-y-1">
                  <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-destructive" />
                  <p className="font-semibold">
                    {(userIncentivesError as any)?.response?.status === 403
                      ? 'Unauthorized: You do not have permission to view this employee’s performance targets.'
                      : 'Failed to load employee performance targets. Please try again later.'}
                  </p>
                </div>
              ) : userIncentives.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-xs border rounded-xl bg-accent/20">
                  No sales targets configured for this employee.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userIncentives.map((inc: any) => (
                    <div key={inc.id} className="p-4 rounded-xl border bg-muted/10 space-y-2">
                      <div className="flex justify-between items-center border-b pb-2">
                        <span className="font-bold text-sm">{inc.type || 'Quarterly Target'}</span>
                        <StatusBadge status={inc.status || 'PENDING'} />
                      </div>
                      <div className="space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Target Benchmark:</span>
                          <strong>₹{Number(inc.targetAmount || 0).toLocaleString('en-IN')}</strong>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Actual Achieved:</span>
                          <strong className="text-emerald-600">₹{Number(inc.achievedAmount || 0).toLocaleString('en-IN')}</strong>
                        </div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-amber-500/5 text-amber-700 dark:text-amber-300 border border-amber-500/20 flex items-center justify-between text-xs">
                        <span className="font-semibold">Payable Incentive:</span>
                        <span className="font-bold italic">Calculation Pending Business Policy Approval</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin Reset Password Modal */}
        {resetModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
              <h2 className="text-base font-bold flex items-center gap-2">
                <Key className="h-5 w-5 text-amber-500" />
                Reset Password for {profile.name}
              </h2>
              {resetResult ? (
                <div className="space-y-4">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-300 rounded-lg text-emerald-700 text-xs">
                    Password generated and saved successfully:
                  </div>
                  <div className="flex items-center gap-2 bg-muted p-3 rounded-lg font-mono text-sm font-bold">
                    <span className="flex-1">{resetResult}</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(resetResult);
                        toast.success('Password copied to clipboard');
                      }}
                      className="p-1.5 hover:bg-accent rounded"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => setResetModalOpen(false)}
                    className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    Enter a custom password below, or leave blank to automatically generate a secure 12-character password.
                  </p>
                  <div>
                    <label className="text-xs font-medium block mb-1">Custom Password (Optional)</label>
                    <input
                      type="text"
                      value={customPassword}
                      onChange={(e) => setCustomPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate"
                      className="w-full px-3 py-2 border rounded-lg bg-background text-sm font-mono"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2 pt-2 border-t">
                    <button
                      type="button"
                      onClick={() => setResetModalOpen(false)}
                      className="px-4 py-2 border rounded-lg text-sm hover:bg-muted"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => resetPasswordMutation.mutate(customPassword || undefined)}
                      disabled={resetPasswordMutation.isPending}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90"
                    >
                      {resetPasswordMutation.isPending ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
