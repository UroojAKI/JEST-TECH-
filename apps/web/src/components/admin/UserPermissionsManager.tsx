'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Minus,
  RotateCcw,
  Save,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lock,
  Layers,
} from 'lucide-react';

interface PermissionDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
}

interface UserPermissionsResponse {
  userId: string;
  role: {
    id: string;
    name: string;
    code: string;
    type: string;
  };
  basePermissions: string[];
  overrides: {
    granted: string[];
    revoked: string[];
    scopes: Record<string, string>;
    updatedAt?: string;
  };
  effectivePermissions: string[];
}

interface Props {
  userId: string;
  canManage?: boolean;
}

const SCOPE_OPTIONS = [
  { value: 'DEFAULT', label: 'Default (Inherited)' },
  { value: 'OWN', label: 'Own Records Only (OWN)' },
  { value: 'BRANCH', label: 'Branch Records (BRANCH)' },
  { value: 'COMPANY', label: 'Company-Wide (COMPANY)' },
  { value: 'ALL', label: 'Global Access (ALL)' },
];

export function UserPermissionsManager({ userId, canManage = true }: Props) {
  const queryClient = useQueryClient();

  // 1. Fetch current user permissions & overrides
  const {
    data: permsData,
    isLoading: isPermsLoading,
    error: permsError,
    refetch,
  } = useQuery<UserPermissionsResponse>({
    queryKey: ['admin', 'users', userId, 'permissions'],
    queryFn: async () => (await apiClient.get(`/users/${userId}/permissions`)).data,
    enabled: !!userId,
  });

  // 2. Fetch full catalog of permissions
  const { data: catalog = [] } = useQuery<PermissionDefinition[]>({
    queryKey: ['admin', 'permissions', 'catalog'],
    queryFn: async () => (await apiClient.get('/users/permissions/catalog')).data,
  });

  // Local state for editing overrides
  const [granted, setGranted] = useState<string[]>([]);
  const [revoked, setRevoked] = useState<string[]>([]);
  const [scopes, setScopes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [filterView, setFilterView] = useState<'all' | 'effective' | 'overridden'>('all');
  const [hasChanges, setHasChanges] = useState(false);

  // Sync state when backend data loads
  useEffect(() => {
    if (permsData?.overrides) {
      setGranted(permsData.overrides.granted || []);
      setRevoked(permsData.overrides.revoked || []);
      setScopes(permsData.overrides.scopes || {});
      setHasChanges(false);
    }
  }, [permsData]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    catalog.forEach((p) => set.add(p.category));
    return ['ALL', ...Array.from(set).sort()];
  }, [catalog]);

  const basePermissions = useMemo(
    () => new Set(permsData?.basePermissions || []),
    [permsData?.basePermissions],
  );

  // Handlers for granting / revoking
  const handleToggleGrant = (code: string) => {
    if (!canManage) return;
    setGranted((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      return next;
    });
    setHasChanges(true);
  };

  const handleToggleRevoke = (code: string) => {
    if (!canManage) return;
    setRevoked((prev) => {
      const next = prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code];
      return next;
    });
    setHasChanges(true);
  };

  const handleScopeChange = (code: string, newScope: string) => {
    if (!canManage) return;
    setScopes((prev) => {
      const next = { ...prev };
      if (newScope === 'DEFAULT') {
        delete next[code];
      } else {
        next[code] = newScope;
      }
      return next;
    });
    setHasChanges(true);
  };

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      return apiClient.put(`/users/${userId}/permissions`, {
        granted,
        revoked,
        scopes,
      });
    },
    onSuccess: () => {
      toast.success('User permission overrides saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'permissions'] });
      setHasChanges(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to save permission overrides.');
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      return apiClient.delete(`/users/${userId}/permissions`);
    },
    onSuccess: () => {
      toast.success('Permissions reset to role baseline.');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', userId, 'permissions'] });
      setHasChanges(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to reset permissions.');
    },
  });

  // Filtered permission catalog items
  const filteredCatalog = useMemo(() => {
    return catalog.filter((p) => {
      if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matches =
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q);
        if (!matches) return false;
      }

      const isBase = basePermissions.has(p.code);
      const isGranted = granted.includes(p.code);
      const isRevoked = revoked.includes(p.code);
      const isEffective = (isBase || isGranted) && !isRevoked;

      if (filterView === 'effective') return isEffective;
      if (filterView === 'overridden') return isGranted || isRevoked;
      return true;
    });
  }, [catalog, selectedCategory, search, filterView, basePermissions, granted, revoked]);

  const effectiveCount = useMemo(() => {
    let count = 0;
    catalog.forEach((p) => {
      const isBase = basePermissions.has(p.code);
      const isGranted = granted.includes(p.code);
      const isRevoked = revoked.includes(p.code);
      if ((isBase || isGranted) && !isRevoked) count++;
    });
    return count;
  }, [catalog, basePermissions, granted, revoked]);

  if (isPermsLoading) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
        Loading user permission configuration and role baseline...
      </div>
    );
  }

  if (permsError) {
    return (
      <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        <span>Failed to load permission overrides for this user.</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Role Baseline Header Banner */}
      <div className="p-4 rounded-2xl border bg-card shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-foreground">
                  Role Baseline: {permsData?.role.name} ({permsData?.role.code})
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                  {permsData?.role.type}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Baseline permissions are inherited from the assigned role. Individual grants add capabilities; individual revocations strip inherited permissions.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          {canManage && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all overrides and return this user strictly to the role baseline?')) {
                    resetMutation.mutate();
                  }
                }}
                disabled={resetMutation.isPending || (granted.length === 0 && revoked.length === 0 && Object.keys(scopes).length === 0)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset to Baseline</span>
              </button>
              <button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !hasChanges}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saveMutation.isPending ? 'Saving...' : 'Save Overrides'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Real-time stats summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t">
          <div className="p-2.5 rounded-xl bg-muted/20 border">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
              Role Baseline
            </span>
            <span className="text-sm font-black text-foreground">
              {basePermissions.size} permissions
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">
              + Individually Granted
            </span>
            <span className="text-sm font-black text-blue-700 dark:text-blue-300">
              +{granted.length} overrides
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <span className="text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">
              — Individually Revoked
            </span>
            <span className="text-sm font-black text-rose-700 dark:text-rose-300">
              -{revoked.length} overrides
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
              = Total Effective in Force
            </span>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-300">
              {effectiveCount} active
            </span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[240px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search permissions by name, code, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border bg-background font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-lg border bg-background font-medium focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === 'ALL' ? 'All Categories' : c}
              </option>
            ))}
          </select>
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg border bg-muted/20 text-xs">
          <button
            type="button"
            onClick={() => setFilterView('all')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterView === 'all'
                ? 'bg-background shadow-xs text-foreground font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All Catalog ({catalog.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterView('effective')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterView === 'effective'
                ? 'bg-background shadow-xs text-emerald-600 font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Effective Active ({effectiveCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterView('overridden')}
            className={`px-3 py-1 rounded-md font-semibold transition-colors ${
              filterView === 'overridden'
                ? 'bg-background shadow-xs text-primary font-bold'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Overridden Only ({granted.length + revoked.length})
          </button>
        </div>
      </div>

      {/* Permissions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredCatalog.map((p) => {
          const isBase = basePermissions.has(p.code);
          const isGranted = granted.includes(p.code);
          const isRevoked = revoked.includes(p.code);
          const isEffective = (isBase || isGranted) && !isRevoked;
          const currentScope = scopes[p.code] || 'DEFAULT';

          return (
            <div
              key={p.code}
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                isRevoked
                  ? 'border-rose-200 bg-rose-500/5 opacity-70'
                  : isGranted
                  ? 'border-blue-200 bg-blue-500/5 shadow-xs'
                  : isEffective
                  ? 'border-emerald-200/60 bg-card'
                  : 'border-border/60 bg-muted/10 opacity-60'
              }`}
            >
              {/* Permission Header */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{p.name}</span>
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                      {p.category}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-primary block mt-0.5">{p.code}</span>
                </div>

                {/* Status Badges */}
                <div className="flex items-center gap-1">
                  {isRevoked ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 inline-flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Revoked
                    </span>
                  ) : isGranted ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 inline-flex items-center gap-1">
                      <Plus className="h-3 w-3" /> Granted Override
                    </span>
                  ) : isBase ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Role Baseline
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground border">
                      Not Granted
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                {p.description}
              </p>

              {/* Controls: Override Toggle & Record Scope */}
              {canManage && (
                <div className="pt-2 border-t flex items-center justify-between gap-2">
                  {/* Record-Level Scope */}
                  <div className="flex items-center gap-1.5 text-[11px]">
                    <span className="text-muted-foreground font-semibold">Scope:</span>
                    <select
                      value={currentScope}
                      onChange={(e) => handleScopeChange(p.code, e.target.value)}
                      disabled={!isEffective}
                      className="px-2 py-0.5 rounded text-[10px] font-medium border bg-background disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {SCOPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Grant / Revoke Action */}
                  <div>
                    {isBase ? (
                      isRevoked ? (
                        <button
                          type="button"
                          onClick={() => handleToggleRevoke(p.code)}
                          className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline"
                        >
                          Restore to Role Default
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleRevoke(p.code)}
                          className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline inline-flex items-center gap-1"
                        >
                          <Minus className="h-3 w-3" /> Revoke for User
                        </button>
                      )
                    ) : isGranted ? (
                      <button
                        type="button"
                        onClick={() => handleToggleGrant(p.code)}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline"
                      >
                        Remove Individual Grant
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleGrant(p.code)}
                        className="text-[11px] font-bold text-primary hover:text-primary/80 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" /> Grant to User
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredCatalog.length === 0 && (
        <div className="p-8 text-center border rounded-2xl bg-card text-muted-foreground text-xs">
          No permissions found matching your search or filters.
        </div>
      )}
    </div>
  );
}
