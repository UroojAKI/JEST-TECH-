'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Shield, Save, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminRoles } from '../../../hooks/useAdmin';

const MODULES = [
  'Customer 360',
  'Lead Workspace',
  'Quotation Engine',
  'Proposals & Underwriting',
  'Policy Operations',
  'Claims Operations',
  'Finance & Accounting',
  'Reports & BI',
  'System Administration',
];

const ROLES = [
  { id: 'SUPER_ADMIN', name: 'Super Admin' },
  { id: 'ADMIN', name: 'System Admin' },
  { id: 'BRANCH_MANAGER', name: 'Branch Manager' },
  { id: 'SALES_AGENT', name: 'Sales Agent' },
  { id: 'UNDERWRITER', name: 'Underwriter' },
  { id: 'FINANCE', name: 'Finance Manager' },
];

export default function RolePermissionMatrixPage() {
  const { data: roles = [], isLoading } = useAdminRoles();
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('BRANCH_MANAGER');
  const [permissionsState, setPermissionsState] = useState<Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean; approve: boolean; export: boolean }>>({
    'Customer 360': { view: true, create: true, update: true, delete: false, approve: false, export: true },
    'Lead Workspace': { view: true, create: true, update: true, delete: false, approve: false, export: true },
    'Quotation Engine': { view: true, create: true, update: true, delete: false, approve: false, export: true },
    'Proposals & Underwriting': { view: true, create: false, update: false, delete: false, approve: false, export: false },
    'Policy Operations': { view: true, create: true, update: true, delete: false, approve: true, export: true },
    'Claims Operations': { view: true, create: true, update: false, delete: false, approve: false, export: false },
    'Finance & Accounting': { view: true, create: false, update: false, delete: false, approve: false, export: true },
    'Reports & BI': { view: true, create: false, update: false, delete: false, approve: false, export: true },
    'System Administration': { view: false, create: false, update: false, delete: false, approve: false, export: false },
  });

  const handleToggle = (module: string, action: 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export') => {
    setPermissionsState({
      ...permissionsState,
      [module]: {
        ...permissionsState[module],
        [action]: !permissionsState[module][action],
      },
    });
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Interactive Role & Permission Matrix
          </h1>
          <p className="text-xs text-muted-foreground">Configure granular action-based and scope-based permissions across every system module</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => toast.success('Permission matrix changes queued for sync!')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            <span>Save Matrix Changes</span>
          </button>
        </div>
      </div>

      {/* Role Picker Strip */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRole(r.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedRole === r.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {r.name}
          </button>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3.5">Module / Feature Domain</th>
              <th className="p-3.5 text-center">View</th>
              <th className="p-3.5 text-center">Create</th>
              <th className="p-3.5 text-center">Update</th>
              <th className="p-3.5 text-center">Delete</th>
              <th className="p-3.5 text-center">Approve</th>
              <th className="p-3.5 text-center">Export</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MODULES.map((mod) => {
              const p = permissionsState[mod] || { view: false, create: false, update: false, delete: false, approve: false, export: false };
              return (
                <tr key={mod} className="hover:bg-accent/40">
                  <td className="p-3.5 font-bold text-foreground">{mod}</td>
                  {(['view', 'create', 'update', 'delete', 'approve', 'export'] as const).map((act) => (
                    <td key={act} className="p-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={p[act]}
                        onChange={() => handleToggle(mod, act)}
                        className="h-4 w-4 rounded accent-primary cursor-pointer"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
