'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Shield, Save, Loader2, Lock, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAdminRoles, useRolePermissions } from '../../../hooks/useAdmin';
import { useAuthStore } from '../../../store/auth-store';

const SCOPE_OPTIONS = ['OWN', 'ASSIGNED', 'ORGANIZATION', 'ALL'] as const;
type AccessScope = typeof SCOPE_OPTIONS[number];

const CANONICAL_ROLES = [
  { id: 'ADMIN', name: 'Administrator', description: 'Organization administration' },
  { id: 'BACK_OFFICE', name: 'Back Office Operations', description: 'Processing, underwriting and finance' },
  { id: 'AGENT', name: 'Insurance Agent', description: 'Assigned and self-owned work' },
];

export default function RolePermissionMatrixPage() {
  const { user } = useAuthStore();
  const { data: dbRoles = [], isLoading: loadingRoles, isError: rolesError, refetch: refetchRoles } = useAdminRoles();
  const [selectedRole, setSelectedRole] = useState<string>('BACK_OFFICE');
  const { rolePermissions, isLoading, isError, isUpdating, updateRolePermissions } = useRolePermissions(selectedRole);
  const [permissionsState, setPermissionsState] = useState<Record<string, AccessScope[]>>({});

  // The system role mutation endpoint is intentionally restricted to a platform super-admin.
  // Keep the UI read-only for tenant administrators instead of allowing edits that will 403.
  const actorPermissions = Array.isArray((user as any)?.permissions) ? (user as any).permissions as string[] : [];
  const canEdit = actorPermissions.includes('*');
  const availablePermissions: any[] = Array.isArray(rolePermissions?.availablePermissions)
    ? rolePermissions.availablePermissions
    : [];
  const assignedPermissions: any[] = Array.isArray(rolePermissions?.permissions)
    ? rolePermissions.permissions
    : [];

  useEffect(() => {
    const next: Record<string, AccessScope[]> = {};
    for (const permission of availablePermissions) next[permission.id] = [];
    for (const grant of assignedPermissions) {
      if (!grant.permissionId || !next[grant.permissionId]) continue;
      const scope = String(grant.scope || 'ORGANIZATION') as AccessScope;
      if ((SCOPE_OPTIONS as readonly string[]).includes(scope) && !next[grant.permissionId].includes(scope)) {
        next[grant.permissionId].push(scope);
      }
    }
    setPermissionsState(next);
  }, [rolePermissions]);

  const grouped = useMemo(() => {
    const groups = new Map<string, any[]>();
    for (const permission of availablePermissions) {
      const key = String(permission.category || 'OTHER');
      groups.set(key, [...(groups.get(key) || []), permission]);
    }
    return Array.from(groups.entries());
  }, [availablePermissions]);

  const handleToggle = (permissionId: string, scope: AccessScope) => {
    setPermissionsState((previous) => {
      const existing = previous[permissionId] || [];
      return {
        ...previous,
        [permissionId]: existing.includes(scope)
          ? existing.filter((value) => value !== scope)
          : [...existing, scope],
      };
    });
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Only a platform super-administrator can change system-wide role permissions.');
      return;
    }
    try {
      const grants = Object.entries(permissionsState).flatMap(([permissionId, scopes]) =>
        scopes.map((scope) => ({ permissionId, scope })),
      );
      await updateRolePermissions({ roleId: selectedRole, permissions: grants });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save role permissions');
    }
  };

  const refresh = () => {
    void refetchRoles();
    window.location.reload();
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Role &amp; Permission Administration
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              This matrix is generated from the actual permission catalog and persisted role grants. Scopes are independent grants; the UI never invents permissions from display labels.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={refresh} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!canEdit || isUpdating || isLoading || isError || availablePermissions.length === 0}
              title={!canEdit ? 'Platform super-admin permission required' : undefined}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isUpdating ? 'Saving…' : 'Save role grants'}
            </button>
          </div>
        </div>

        {!canEdit && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">Read-only for this account</p>
              <p className="mt-1 text-xs text-muted-foreground">
                System role permissions are global. The API allows mutation only to a platform super-administrator. Contact that administrator to change these grants; the matrix remains readable here.
              </p>
            </div>
          </div>
        )}

        {rolesError && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">
            Failed to load roles. The permission matrix is not editable until roles are loaded.
          </div>
        )}

        <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-2">
          {CANONICAL_ROLES.map((role) => {
            const existsInDb = dbRoles.some((item: any) => (item.code || item.type || item.id) === role.id);
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`rounded-lg border px-3 py-2 text-left ${selectedRole === role.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-accent'}`}
              >
                <div className="text-xs font-bold">{role.name}</div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{role.description}</div>
                <div className={`mt-1 text-[9px] font-bold ${existsInDb ? 'text-emerald-700' : 'text-amber-700'}`}>{existsInDb ? 'IN DATABASE' : 'ROLE NOT FOUND'}</div>
              </button>
            );
          })}
        </div>

        {isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-xs">
            <p className="font-semibold">Permission catalog failed to load.</p>
            <p className="mt-1 text-muted-foreground">No unchecked/default matrix is shown because it could be mistaken for the actual persisted grants.</p>
          </div>
        ) : isLoading || loadingRoles ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading role grants and permission catalog…</div>
        ) : availablePermissions.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" />
            <p className="mt-2 text-sm font-bold">No permission catalog returned</p>
            <p className="mt-1 text-xs text-muted-foreground">Check the API deployment. The matrix will not create permission names from UI labels.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span>OWN = records the user owns</span>
              <span>ASSIGNED = explicitly assigned records</span>
              <span>ORGANIZATION = tenant-wide records</span>
              <span>ALL = platform-wide scope</span>
            </div>
            {grouped.map(([category, permissions]) => (
              <section key={category} className="overflow-hidden rounded-xl border bg-card">
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-3">
                  <h2 className="text-xs font-extrabold uppercase tracking-wide">{category.replace(/_/g, ' ')}</h2>
                  <span className="text-[10px] text-muted-foreground">{permissions.length} permissions</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[750px] text-left text-xs">
                    <thead className="bg-muted/20 text-[10px] uppercase text-muted-foreground">
                      <tr>
                        <th className="p-3">Permission</th>
                        {SCOPE_OPTIONS.map((scope) => <th className="p-3 text-center" key={scope}>{scope}</th>)}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {permissions.map((permission: any) => (
                        <tr key={permission.id} className="hover:bg-accent/20">
                          <td className="p-3">
                            <div className="font-semibold">{permission.name}</div>
                            <code className="mt-1 block text-[10px] text-muted-foreground">{permission.code}</code>
                            {permission.description && <div className="mt-1 max-w-xl text-[10px] text-muted-foreground">{permission.description}</div>}
                          </td>
                          {SCOPE_OPTIONS.map((scope) => (
                            <td key={scope} className="p-3 text-center">
                              <input
                                type="checkbox"
                                aria-label={permission.code + ' ' + scope}
                                checked={(permissionsState[permission.id] || []).includes(scope)}
                                onChange={() => handleToggle(permission.id, scope)}
                                disabled={!canEdit || isUpdating}
                                className="h-4 w-4 accent-primary disabled:cursor-not-allowed"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
