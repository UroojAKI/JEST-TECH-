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
} from 'lucide-react';

export default function User360Page() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = params?.id as string;

  const [activeTab, setActiveTab] = useState<'overview' | 'portfolio' | 'activities' | 'tasks' | 'organization' | 'security' | 'finance'>('overview');
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [customPassword, setCustomPassword] = useState('');
  const [resetResult, setResetResult] = useState<string | null>(null);

  const { data: workspace, isLoading, error, refetch } = useQuery<UserWorkspaceData>({
    queryKey: ['admin', 'users', 'workspace', userId],
    queryFn: () => adminRepository.getUserWorkspace(userId),
    enabled: !!userId,
  });

    const { data: userCommissions = [], isLoading: isUserCommissionsLoading } = useQuery({
    queryKey: ['admin', 'users', 'commissions', userId],
    queryFn: async () => {
      const res = await apiClient.get('/finance/commissions');
      const all = Array.isArray(res.data) ? res.data : [];
      return all.filter(
        (c: any) =>
          c.userId === userId ||
          c.agentId === userId ||
          (workspace?.profile?.name && c.agentName?.toLowerCase().includes(workspace.profile.name.toLowerCase()))
      );
    },
    enabled: !!userId,
  });

  const { data: userIncentives = [], isLoading: isUserIncentivesLoading } = useQuery({
    queryKey: ['admin', 'users', 'incentives', userId],
    queryFn: async () => {
      const res = await apiClient.get('/finance/incentives');
      const all = Array.isArray(res.data) ? res.data : [];
      return all.filter(
        (i: any) =>
          i.userId === userId ||
          (workspace?.profile?.name && i.employeeName?.toLowerCase().includes(workspace.profile.name.toLowerCase()))
      );
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

  const { profile, portfolio, recentActivities, recentTasks } = workspace;
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 pt-3 border-t">
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Assigned Leads</div>
              <div className="text-xl font-bold font-mono mt-0.5">{portfolio.leadsAssigned}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Converted Leads</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-emerald-600">{portfolio.leadsConverted}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Conversion Rate</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-primary">{conversionRate}%</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Managed Customers</div>
              <div className="text-xl font-bold font-mono mt-0.5">{portfolio.customersManaged}</div>
            </div>
            <div className="p-3 bg-muted/40 rounded-xl">
              <div className="text-[11px] text-muted-foreground font-medium">Policies Issued</div>
              <div className="text-xl font-bold font-mono mt-0.5 text-indigo-600">{portfolio.policiesIssued}</div>
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
                        {profile.agentProfile.agentCode} ({profile.agentProfile.commissionTier || 'STANDARD'})
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
          </div>
        )}

        {/* Tab Content: WORK PORTFOLIO */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Leads Lifecycle</span>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </div>
                <div className="text-3xl font-bold font-mono">{portfolio.leadsAssigned}</div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Created by user:</span>
                    <span className="font-mono font-semibold">{portfolio.leadsCreated}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Converted:</span>
                    <span className="font-mono">{portfolio.leadsConverted}</span>
                  </div>
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Lost / Dropped:</span>
                    <span className="font-mono">{portfolio.leadsLost}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Client Base</span>
                  <Users className="h-4 w-4 text-emerald-600" />
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-600">{portfolio.customersManaged}</div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Customers Created:</span>
                    <span className="font-mono font-semibold">{portfolio.customersCreated}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Contacts Authored:</span>
                    <span className="font-mono font-semibold">{portfolio.contactsCreated}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Policies & Issuance</span>
                  <Award className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="text-3xl font-bold font-mono text-indigo-600">{portfolio.policiesIssued}</div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Active Policies:</span>
                    <span className="font-mono font-semibold">{portfolio.policiesIssued}</span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-semibold">
                    <span>Upcoming Renewals (30d):</span>
                    <span className="font-mono">{portfolio.renewalsPending}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-2xl p-5 bg-card shadow-sm space-y-2">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider">Workload Tasks</span>
                  <CheckSquare className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-3xl font-bold font-mono text-amber-600">{portfolio.pendingTasks}</div>
                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between text-rose-500 font-semibold">
                    <span>Overdue Tasks:</span>
                    <span className="font-mono">{portfolio.overdueTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pending Queue:</span>
                    <span className="font-mono font-semibold">{portfolio.pendingTasks}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: ACTIVITIES & AUDIT */}
        {activeTab === 'activities' && (
          <div className="border rounded-2xl overflow-hidden bg-card">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Recent User Audit Trail ({recentActivities.length} Events)
              </h2>
            </div>
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No recent activity logs recorded for this user account.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-muted/40 text-[10px] uppercase font-bold text-muted-foreground border-b">
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">Entity ID</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Metadata</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {recentActivities.map((act) => (
                    <tr key={act.id} className="hover:bg-accent/40">
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                          {act.action}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-foreground">{act.entity}</td>
                      <td className="p-3 text-muted-foreground truncate max-w-[120px]">{act.entityId}</td>
                      <td className="p-3 text-muted-foreground">{act.ipAddress || '127.0.0.1'}</td>
                      <td className="p-3 text-muted-foreground text-[11px]">
                        {new Date(act.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {act.details ? JSON.stringify(act.details) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
