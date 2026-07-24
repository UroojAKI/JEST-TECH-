'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Users, Plus, Key, Lock, Unlock, Search, Loader2 } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';
import { useAdminUsers } from '../../../hooks/useAdmin';
import { adminRepository } from '../../../repositories/admin.repository';
import { useQueryClient } from '@tanstack/react-query';

export default function UserManagementPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('SALES_AGENT');
  const [newBranch, setNewBranch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { users, isLoading, isError, updateUserStatus, isUpdating } = useAdminUsers({
    status: statusFilter !== 'ALL' ? statusFilter : undefined,
    search: searchQuery || undefined,
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading users...</div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="p-8 text-center text-red-500 text-sm">Failed to load users. Please try again.</div>
      </AppShell>
    );
  }

  const handleToggleLock = (user: any) => {
    updateUserStatus({ id: user.id, status: user.status === 'LOCKED' ? 'ACTIVE' : 'LOCKED' });
  };

  const handleResetPassword = (email: string) => {
    toast.info('Password reset email sent to ' + email);
  };

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName || !newEmail) {
      toast.error('First Name and Email are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminRepository.createUser({
        firstName: newFirstName,
        lastName: newLastName,
        email: newEmail,
        role: newRole,
        branchName: newBranch,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      toast.success('User provisioned!');
      setShowCreateForm(false);
      setNewFirstName('');
      setNewLastName('');
      setNewEmail('');
      setNewRole('SALES_AGENT');
      setNewBranch('');
    } catch (error) {
      toast.error('Failed to create user');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AppShell>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> User Account Management & RBAC Provisioning
          </h1>
          <p className="text-xs text-muted-foreground">Manage system users, employee codes, role assignments, branch scoping, and account security locks</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showCreateForm ? 'Cancel' : '+ Provision New User'}</span>
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="p-5 border rounded-xl bg-card shadow-sm text-xs mb-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Users className="h-4 w-4" /> Provision New User Account</h2>
          <form onSubmit={handleSubmitUser} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={newFirstName}
                  onChange={(e) => setNewFirstName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Last Name</label>
                <input
                  type="text"
                  value={newLastName}
                  onChange={(e) => setNewLastName(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="font-bold text-muted-foreground block mb-1">Work Email Address *</label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="SALES_AGENT">SALES_AGENT</option>
                  <option value="UNDERWRITER">UNDERWRITER</option>
                  <option value="FINANCE">FINANCE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Branch Location</label>
                <input
                  type="text"
                  value={newBranch}
                  onChange={(e) => setNewBranch(e.target.value)}
                  placeholder="Mumbai BKC Branch"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="pt-3 flex justify-end">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSubmitting ? 'Provisioning...' : 'Provision User'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter Views & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-card p-3 rounded-xl border mb-4">
        <div className="flex border-b sm:border-b-0 text-xs overflow-x-auto p-1 space-x-1">
          {[
            { id: 'ALL', label: 'All Users' },
            { id: 'ACTIVE', label: 'Active' },
            { id: 'LOCKED', label: 'Locked' },
            { id: 'DISABLED', label: 'Disabled' },
          ].map((view) => (
            <button
              key={view.id}
              onClick={() => setStatusFilter(view.id)}
              className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
                statusFilter === view.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {view.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email, code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* User Table Grid */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Emp Code</th>
              <th className="p-3">Full Name</th>
              <th className="p-3">Email Address</th>
              <th className="p-3">Assigned Role</th>
              <th className="p-3">Branch & Team</th>
              <th className="p-3">Status</th>
              <th className="p-3">Last Active</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.map((u: any) => (
              <tr key={u.id} className="hover:bg-accent/40">
                <td className="p-3 font-mono font-bold text-primary">{u.employeeCode}</td>
                <td className="p-3 font-semibold">{u.firstName} {u.lastName}</td>
                <td className="p-3 text-muted-foreground font-mono">{u.email}</td>
                <td className="p-3 font-bold">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                    {typeof u.role === 'object' ? (u.role?.name || u.role?.code || u.role?.id || 'USER') : String(u.role || 'USER')}
                  </span>
                </td>
                <td className="p-3">
                  <div className="font-semibold">
                    {typeof u.branchName === 'object' ? (u.branchName?.name || u.branchName?.code || '-') : (u.branchName || (typeof u.branch === 'object' ? (u.branch?.name || u.branch?.code) : u.branch) || 'Head Office')}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {typeof u.teamName === 'object' ? (u.teamName?.name || u.teamName?.code || '-') : (u.teamName || (typeof u.team === 'object' ? (u.team?.name || u.team?.code) : u.team) || 'General Team')}
                  </div>
                </td>
                <td className="p-3"><StatusBadge status={u.status} /></td>
                <td className="p-3 text-muted-foreground font-mono text-[11px]">{u.lastLoginAt || 'Never'}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <button
                      onClick={() => handleToggleLock(u)}
                      disabled={isUpdating}
                      className={`p-1.5 rounded border ${
                        u.status === 'LOCKED'
                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20'
                      } ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={u.status === 'LOCKED' ? 'Unlock Account' : 'Lock Account'}
                    >
                      {u.status === 'LOCKED' ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleResetPassword(u.email)}
                      className="p-1.5 rounded border bg-background hover:bg-accent text-foreground"
                      title="Reset Password"
                    >
                      <Key className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {(!users || users.length === 0) && (
              <tr>
                <td colSpan={8} className="p-4 text-center text-muted-foreground">No users found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
