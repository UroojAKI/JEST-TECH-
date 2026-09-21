'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Shield, Save, Loader2, CheckCircle2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminRoles, useRolePermissions } from '../../../hooks/useAdmin';

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

const CANONICAL_ROLES = [
  { id: 'ADMIN', name: 'System Administrator', designation: 'Tenant Governance & Config' },
  { id: 'BACK_OFFICE', name: 'Back Office Operations', designation: 'Operations, Underwriting, Finance' },
  { id: 'AGENT', name: 'Insurance Agent', designation: 'Customer Sales & Field Work' },
];

export default function RolePermissionMatrixPage() {
  const { data: dbRoles = [] } = useAdminRoles();
  const [selectedRole, setSelectedRole] = useState<string>('BACK_OFFICE');

  const { rolePermissions, isLoading, isUpdating, updateRolePermissions } = useRolePermissions(selectedRole);

  const [permissionsState, setPermissionsState] = useState<
    Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean; approve: boolean; export: boolean }>
  >({});

  // Sync state when role permissions load from server
  useEffect(() => {
    const initialState: Record<string, { view: boolean; create: boolean; update: boolean; delete: boolean; approve: boolean; export: boolean }> = {};
    MODULES.forEach((mod) => {
      initialState[mod] = {
        view: selectedRole !== 'AGENT' || mod !== 'System Administration',
        create: selectedRole !== 'AGENT' || ['Customer 360', 'Lead Workspace', 'Quotation Engine'].includes(mod),
        update: selectedRole !== 'AGENT' || ['Customer 360', 'Lead Workspace', 'Quotation Engine'].includes(mod),
        delete: selectedRole === 'ADMIN',
        approve: selectedRole === 'ADMIN' || (selectedRole === 'BACK_OFFICE' && ['Policy Operations', 'Claims Operations'].includes(mod)),
        export: selectedRole !== 'AGENT' || ['Customer 360', 'Lead Workspace'].includes(mod),
      };
    });

    if (rolePermissions?.permissions && Array.isArray(rolePermissions.permissions)) {
      rolePermissions.permissions.forEach((p: any) => {
        const matchingMod = MODULES.find((m) => {
          const slug = m.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
          return p.code && String(p.code).includes(slug);
        });

        if (matchingMod && initialState[matchingMod]) {
          let action = (p.action || '').toLowerCase();
          if (!action && p.code) {
            const prefix = p.code.split('_')[0].toLowerCase();
            if (['view', 'create', 'update', 'delete', 'approve', 'export'].includes(prefix)) {
              action = prefix;
            }
          }
          if (['view', 'create', 'update', 'delete', 'approve', 'export'].includes(action)) {
            (initialState[matchingMod] as any)[action] = true;
          }
        }
      });
    }

    setPermissionsState(initialState);
  }, [rolePermissions, selectedRole]);

  const handleToggle = (module: string, action: 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export') => {
    setPermissionsState((prev) => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: !prev[module]?.[action],
      },
    }));
  };

  const handleSave = async () => {
    try {
      const activePermissions: Array<{ permissionId?: string; category?: string; action?: string; scope: string }> = [];
      // Build permission payload from current matrix
      MODULES.forEach((mod) => {
        const state = permissionsState[mod];
        if (!state) return;
        (['view', 'create', 'update', 'delete', 'approve', 'export'] as const).forEach((act) => {
          if (state[act]) {
            activePermissions.push({ category: mod, action: act, scope: 'ORGANIZATION' });
          }
        });
      });

      await updateRolePermissions({
        roleId: selectedRole,
        permissions: activePermissions,
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save role permissions');
    }
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" /> Interactive Role &amp; Permission Matrix
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure granular action-based and scope-based permissions across canonical system roles
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSave}
            disabled={isUpdating || isLoading}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4" />}
            <span>{isUpdating ? 'Saving...' : 'Save Matrix Changes'}</span>
          </button>
        </div>
      </div>

      {/* Role Picker Strip */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {CANONICAL_ROLES.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedRole(r.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors text-left ${
              selectedRole === r.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            <div>{r.name}</div>
            <div className="text-[10px] opacity-75 font-normal">{r.designation}</div>
          </button>
        ))}
      </div>

      {/* Permissions Matrix Table */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground animate-pulse">Loading role permissions...</div>
        ) : (
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
        )}
      </div>
    </AppShell>
  );
}
