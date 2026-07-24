'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Users, Plus, Shield, Key, Lock, Unlock, RefreshCw, Filter, Search } from 'lucide-react';
import { useAdminUsers } from '../../../hooks/useAdmin';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_USERS = [
  {
    id: 'USR-001',
    employeeCode: 'EMP-000001',
    firstName: 'System',
    lastName: 'SuperAdmin',
    email: 'superadmin@jest.com',
    role: 'SUPER_ADMIN',
    status: 'ACTIVE',
    branchName: 'Corporate Headquarters (Mumbai)',
    teamName: 'Executive Platform',
    isEmailVerified: true,
    lastLoginAt: '2026-07-24 11:30 IST',
    createdAt: '2026-07-14',
  },
  {
    id: 'USR-002',
    employeeCode: 'EMP-000002',
    firstName: 'System',
    lastName: 'Administrator',
    email: 'admin@jest.com',
    role: 'ADMIN',
    status: 'ACTIVE',
    branchName: 'Mumbai BKC Branch',
    teamName: 'System Administration',
    isEmailVerified: true,
    lastLoginAt: '2026-07-24 10:15 IST',
    createdAt: '2026-07-14',
  },
  {
    id: 'USR-003',
    employeeCode: 'EMP-000003',
    firstName: 'Rajesh',
    lastName: 'Sharma',
    email: 'agent@jest.com',
    role: 'SALES_AGENT',
    status: 'ACTIVE',
    branchName: 'Mumbai BKC Branch',
    teamName: 'Motor Direct Sales',
    isEmailVerified: true,
    lastLoginAt: '2026-07-24 09:45 IST',
    createdAt: '2026-07-15',
  },
  {
    id: 'USR-004',
    employeeCode: 'EMP-000004',
    firstName: 'Anil',
    lastName: 'Kulkarni',
    email: 'underwriter@jest.com',
    role: 'UNDERWRITER',
    status: 'ACTIVE',
    branchName: 'Pune Branch',
    teamName: 'Commercial Underwriting',
    isEmailVerified: true,
    lastLoginAt: '2026-07-23 16:20 IST',
    createdAt: '2026-07-16',
  },
  {
    id: 'USR-005',
    employeeCode: 'EMP-000005',
    firstName: 'Sunil',
    lastName: 'Verma',
    email: 'sunil.verma@jest.com',
    role: 'FINANCE',
    status: 'LOCKED',
    branchName: 'Corporate Headquarters',
    teamName: 'Accounts & Treasury',
    isEmailVerified: true,
    lastLoginAt: '2026-07-20 14:00 IST',
    createdAt: '2026-07-16',
  },
];

export default function UserManagementPage() {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredUsers = MOCK_USERS.filter((u) => {
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesSearch =
      u.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.employeeCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
            onClick={() => alert('Opening Create New User Drawer...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Provision New User</span>
          </button>
        </div>
      </div>

      {/* Filter Views & Search */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-card p-3 rounded-xl border">
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
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-accent/40">
                <td className="p-3 font-mono font-bold text-primary">{u.employeeCode}</td>
                <td className="p-3 font-semibold">{u.firstName} {u.lastName}</td>
                <td className="p-3 text-muted-foreground font-mono">{u.email}</td>
                <td className="p-3 font-bold">
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px]">
                    {u.role}
                  </span>
                </td>
                <td className="p-3">
                  <div className="font-semibold">{u.branchName}</div>
                  <div className="text-[10px] text-muted-foreground">{u.teamName}</div>
                </td>
                <td className="p-3"><StatusBadge status={u.status} /></td>
                <td className="p-3 text-muted-foreground font-mono text-[11px]">{u.lastLoginAt || 'Never'}</td>
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    {u.status === 'LOCKED' ? (
                      <button
                        onClick={() => alert(`Unlocked user account ${u.email}`)}
                        className="p-1.5 rounded border bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                        title="Unlock Account"
                      >
                        <Unlock className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => alert(`Locked user account ${u.email}`)}
                        className="p-1.5 rounded border bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                        title="Lock Account"
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => alert(`Reset password for ${u.email}`)}
                      className="p-1.5 rounded border bg-background hover:bg-accent text-foreground"
                      title="Reset Password"
                    >
                      <Key className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
