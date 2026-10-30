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

const MODULE_CANONICAL_MAP: Record<
  string,
  Record<'view' | 'create' | 'update' | 'delete' | 'approve' | 'export', string[]>
> = {
  'Customer 360': {
    view: ['contact:read', 'VIEW_CUSTOMER_360'],
    create: ['contact:create', 'CREATE_CUSTOMER_360'],
    update: ['contact:update', 'UPDATE_CUSTOMER_360'],
    delete: ['contact:delete', 'DELETE_CUSTOMER_360'],
    approve: ['contact:update', 'APPROVE_CUSTOMER_360'],
    export: ['contact:read', 'EXPORT_CUSTOMER_360'],
  },
  'Lead Workspace': {
    view: ['lead:read', 'VIEW_LEAD_WORKSPACE'],
    create: ['lead:create', 'CREATE_LEAD_WORKSPACE'],
    update: ['lead:update', 'UPDATE_LEAD_WORKSPACE'],
    delete: ['lead:delete', 'DELETE_LEAD_WORKSPACE'],
    approve: ['lead:convert', 'APPROVE_LEAD_WORKSPACE'],
    export: ['lead:read', 'EXPORT_LEAD_WORKSPACE'],
  },
  'Quotation Engine': {
    view: ['quotation:read', 'VIEW_QUOTATION_ENGINE'],
    create: ['quotation:create', 'CREATE_QUOTATION_ENGINE'],
    update: ['quotation:update', 'UPDATE_QUOTATION_ENGINE'],
    delete: ['quotation:reject', 'DELETE_QUOTATION_ENGINE'],
    approve: ['quotation:approve', 'APPROVE_QUOTATION_ENGINE'],
    export: ['quotation:export', 'EXPORT_QUOTATION_ENGINE'],
  },
  'Proposals & Underwriting': {
    view: ['policy:read', 'VIEW_PROPOSALS___UNDERWRITING'],
    create: ['policy:create', 'CREATE_PROPOSALS___UNDERWRITING'],
    update: ['policy:update', 'UPDATE_PROPOSALS___UNDERWRITING'],
    delete: ['policy:cancel', 'DELETE_PROPOSALS___UNDERWRITING'],
    approve: ['policy:issue', 'APPROVE_PROPOSALS___UNDERWRITING'],
    export: ['policy:export', 'EXPORT_PROPOSALS___UNDERWRITING'],
  },
  'Policy Operations': {
    view: ['policy:read', 'VIEW_POLICY_OPERATIONS'],
    create: ['policy:create', 'CREATE_POLICY_OPERATIONS'],
    update: ['policy:update', 'UPDATE_POLICY_OPERATIONS'],
    delete: ['policy:cancel', 'DELETE_POLICY_OPERATIONS'],
    approve: ['policy:issue', 'APPROVE_POLICY_OPERATIONS'],
    export: ['policy:export', 'EXPORT_POLICY_OPERATIONS'],
  },
  'Claims Operations': {
    view: ['claim:read', 'VIEW_CLAIMS_OPERATIONS'],
    create: ['claim:create', 'CREATE_CLAIMS_OPERATIONS'],
    update: ['claim:update', 'UPDATE_CLAIMS_OPERATIONS'],
    delete: ['claim:reject', 'DELETE_CLAIMS_OPERATIONS'],
    approve: ['claim:approve', 'claim:settle', 'APPROVE_CLAIMS_OPERATIONS'],
    export: ['claim:export', 'EXPORT_CLAIMS_OPERATIONS'],
  },
  'Finance & Accounting': {
    view: ['commission:read', 'VIEW_FINANCE___ACCOUNTING'],
    create: ['commission:configure', 'CREATE_FINANCE___ACCOUNTING'],
    update: ['commission:process', 'UPDATE_FINANCE___ACCOUNTING'],
    delete: ['commission:process', 'DELETE_FINANCE___ACCOUNTING'],
    approve: ['commission:process', 'APPROVE_FINANCE___ACCOUNTING'],
    export: ['commission:export', 'EXPORT_FINANCE___ACCOUNTING'],
  },
  'Reports & BI': {
    view: ['report:read', 'report:view', 'VIEW_REPORTS___BI'],
    create: ['report:create', 'CREATE_REPORTS___BI'],
    update: ['report:execute', 'UPDATE_REPORTS___BI'],
    delete: ['report:export', 'DELETE_REPORTS___BI'],
    approve: ['report:export', 'APPROVE_REPORTS___BI'],
    export: ['report:export', 'EXPORT_REPORTS___BI'],
  },
  'System Administration': {
    view: ['user:read', 'audit:read', 'VIEW_SYSTEM_ADMINISTRATION'],
    create: ['user:create', 'CREATE_SYSTEM_ADMINISTRATION'],
    update: ['user:update', 'UPDATE_SYSTEM_ADMINISTRATION'],
    delete: ['user:delete', 'DELETE_SYSTEM_ADMINISTRATION'],
    approve: ['system:manage', 'APPROVE_SYSTEM_ADMINISTRATION'],
    export: ['audit:read', 'EXPORT_SYSTEM_ADMINISTRATION'],
  },
};

const CANONICAL_SAVE_CODE: Record<string, Record<'view' | 'create' | 'update' | 'delete' | 'approve' | 'export', string>> = {
  'Customer 360': { view: 'contact:read', create: 'contact:create', update: 'contact:update', delete: 'contact:delete', approve: 'contact:update', export: 'contact:export' },
  'Lead Workspace': { view: 'lead:read', create: 'lead:create', update: 'lead:update', delete: 'lead:delete', approve: 'opportunity:pipeline', export: 'lead:export' },
  'Quotation Engine': { view: 'quotation:read', create: 'quotation:create', update: 'quotation:update', delete: 'quotation:reject', approve: 'quotation:approve', export: 'quotation:export' },
  'Proposals & Underwriting': { view: 'policy:read', create: 'policy:create', update: 'policy:update', delete: 'policy:cancel', approve: 'policy:issue', export: 'policy:export' },
  'Policy Operations': { view: 'renewal:read', create: 'policy:create', update: 'renewal:update', delete: 'policy:cancel', approve: 'renewal:process', export: 'renewal:export' },
  'Claims Operations': { view: 'claim:read', create: 'claim:create', update: 'claim:update', delete: 'claim:reject', approve: 'claim:approve', export: 'claim:export' },
  'Finance & Accounting': { view: 'commission:read', create: 'commission:configure', update: 'commission:process', delete: 'commission:process', approve: 'commission:process', export: 'commission:export' },
  'Reports & BI': { view: 'report:read', create: 'report:create', update: 'report:execute', delete: 'report:export', approve: 'report:execute', export: 'report:export' },
  'System Administration': { view: 'user:read', create: 'user:create', update: 'user:update', delete: 'user:delete', approve: 'system:manage', export: 'audit:read' },
};

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
        view: false,
        create: false,
        update: false,
        delete: false,
        approve: false,
        export: false,
      };
    });

    if (rolePermissions?.permissions && Array.isArray(rolePermissions.permissions)) {
      rolePermissions.permissions.forEach((p: any) => {
        const permCode = (p.code || '').toLowerCase();
        
        MODULES.forEach((mod) => {
          const actionMap = MODULE_CANONICAL_MAP[mod];
          if (!actionMap) return;

          (['view', 'create', 'update', 'delete', 'approve', 'export'] as const).forEach((act) => {
            const matches = actionMap[act].some((candidate) => candidate.toLowerCase() === permCode);
            if (matches) {
              initialState[mod][act] = true;
            }
          });
        });
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
      const activePermissions: Array<{ code?: string; category?: string; action?: string; scope: string }> = [];
      // Build permission payload with canonical codes from current matrix
      MODULES.forEach((mod) => {
        const state = permissionsState[mod];
        if (!state) return;
        (['view', 'create', 'update', 'delete', 'approve', 'export'] as const).forEach((act) => {
          if (state[act]) {
            const canonicalCode = CANONICAL_SAVE_CODE[mod]?.[act] || `${act.toUpperCase()}_${mod.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;
            activePermissions.push({
              code: canonicalCode,
              category: mod,
              action: act,
              scope: 'ORGANIZATION',
            });
          }
        });
      });

      await updateRolePermissions({
        roleId: selectedRole,
        permissions: activePermissions,
      });
      toast.success(`Saved permissions for role ${selectedRole}`);
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
