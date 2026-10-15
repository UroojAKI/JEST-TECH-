'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Sliders, Save, ToggleLeft, ToggleRight, Loader2, RefreshCw, Lock, AlertTriangle, Settings2 } from 'lucide-react';
import { useSystemConfig, useFeatureFlags } from '../../../hooks/useAdmin';
import { useAuthStore } from '../../../store/auth-store';
import { toast } from 'sonner';

type ConfigRecord = {
  value: unknown;
  valueType: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  configured: boolean;
  isPublic: boolean;
};

const DESCRIPTIONS: Record<string, string> = {
  PASSWORD_MIN_LENGTH: 'Minimum password length enforced by the authentication policy.',
  SESSION_TIMEOUT: 'Session timeout threshold configured in the authentication layer.',
  JWT_ACCESS_EXPIRY: 'Access-token lifetime, using the supported duration format.',
  JWT_REFRESH_EXPIRY: 'Refresh-token lifetime, using the supported duration format.',
  DEFAULT_TIMEZONE: 'Default timezone for scheduled jobs and time formatting.',
  DEFAULT_CURRENCY: 'Default currency code used by the application.',
  MAX_UPLOAD_SIZE: 'Maximum upload size in the unit expected by the upload service.',
  MAX_LOGIN_ATTEMPTS: 'Maximum consecutive authentication failures before lockout.',
  ACCOUNT_LOCK_DURATION: 'Account lock duration in the unit expected by the authentication service.',
  DEFAULT_BRANCH: 'Default branch identifier/code used where an explicit branch is not provided.',
  DEFAULT_LANGUAGE: 'Default language code.',
  ENABLE_AUDIT_LOGS: 'Global switch for audit logging where the audit pipeline reads this setting.',
  ENABLE_NOTIFICATIONS: 'Global switch for notifications where the notification pipeline reads this setting.',
};

function configValueForDraft(record: ConfigRecord) {
  if (record.value !== null && record.value !== undefined) {
    return record.valueType === 'JSON' && typeof record.value !== 'string'
      ? JSON.stringify(record.value, null, 2)
      : record.value;
  }
  if (record.valueType === 'BOOLEAN') return false;
  return '';
}

export default function SystemConfigPage() {
  const { user } = useAuthStore();
  const { config, isLoading, isError, isUpdating, refetch, updateConfig } = useSystemConfig();
  const {
    flags,
    isLoading: flagsLoading,
    isError: flagsError,
    isUpdating: isUpdatingFlag,
    refetch: refetchFlags,
    toggleFlag,
  } = useFeatureFlags();
  const [activeTab, setActiveTab] = useState<'PARAMETERS' | 'FLAGS'>('PARAMETERS');
  const [draftValues, setDraftValues] = useState<Record<string, unknown>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const canEdit = Array.isArray((user as any)?.permissions) &&
    (user as any).permissions.includes('*');

  const configRecords = useMemo(() => {
    const source = (config && typeof config === 'object' ? config : {}) as Record<string, ConfigRecord>;
    return Object.entries(source)
      .map(([key, record]) => ({ key, ...record }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [config]);

  useEffect(() => {
    const next: Record<string, unknown> = {};
    for (const item of configRecords) next[item.key] = configValueForDraft(item);
    setDraftValues(next);
    setDirty({});
  }, [configRecords]);

  const handleChange = (key: string, value: unknown) => {
    setDraftValues((previous) => ({ ...previous, [key]: value }));
    setDirty((previous) => ({ ...previous, [key]: true }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Only a platform super-administrator can change global system parameters.');
      return;
    }
    const changedKeys = Object.keys(dirty).filter((key) => dirty[key]);
    if (!changedKeys.length) {
      toast.info('No configuration changes to save.');
      return;
    }

    const payload: Record<string, unknown> = {};
    try {
      for (const key of changedKeys) {
        const meta = configRecords.find((item) => item.key === key);
        if (!meta) continue;
        const draft = draftValues[key];
        if (meta.valueType === 'NUMBER') {
          if (draft === '' || draft === null || draft === undefined || !Number.isFinite(Number(draft))) {
            throw new Error(key + ' requires a valid number.');
          }
          payload[key] = Number(draft);
        } else if (meta.valueType === 'BOOLEAN') {
          if (typeof draft !== 'boolean') throw new Error(key + ' requires an on/off value.');
          payload[key] = draft;
        } else if (meta.valueType === 'JSON') {
          try {
            payload[key] = typeof draft === 'string' ? JSON.parse(draft) : draft;
          } catch {
            throw new Error(key + ' must contain valid JSON.');
          }
        } else {
          if (typeof draft !== 'string' || !draft.trim()) {
            throw new Error(key + ' cannot be empty.');
          }
          payload[key] = draft.trim();
        }
      }
      if (!Object.keys(payload).length) return;
      setSaving(true);
      await updateConfig(payload);
      await refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Could not save system parameters');
    } finally {
      setSaving(false);
    }
  };

  const configuredFlagCount = flags.filter((flag: any) => flag.isEnabled).length;

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Sliders className="h-5 w-5 text-primary" /> System Parameters &amp; Feature Flags
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Values and feature flags are read from persisted system configuration records. There are no local demo defaults; if a setting is absent, it is shown as not configured.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { void refetch(); void refetchFlags(); }}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh records
          </button>
        </div>

        {!canEdit && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold">Read-only system settings</p>
              <p className="mt-1 text-xs text-muted-foreground">
                These records are global in the current schema. Editing requires the platform super-administrator permission; organization-level changes should use organization-specific configuration records.
              </p>
            </div>
          </div>
        )}

        <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('PARAMETERS')}
            className={'px-3.5 py-2 rounded-lg font-bold transition-colors ' + (activeTab === 'PARAMETERS' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
          >
            Parameters ({configRecords.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FLAGS')}
            className={'px-3.5 py-2 rounded-lg font-bold transition-colors ' + (activeTab === 'FLAGS' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent hover:text-foreground')}
          >
            Persisted Feature Flags ({flags.length})
          </button>
        </div>

        {activeTab === 'PARAMETERS' && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2"><Settings2 className="h-4 w-4" /> Configured parameters</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">Type and key names are controlled by the backend configuration contract.</p>
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={!canEdit || saving || isUpdating || isLoading || isError || !Object.values(dirty).some(Boolean)}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {saving || isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving || isUpdating ? 'Saving…' : 'Save changed parameters'}
              </button>
            </div>

            {isError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">System configuration could not be loaded.</p>
                <p className="mt-1 text-xs text-muted-foreground">No placeholder settings are shown. Retry after checking the API and authorization.</p>
                <button type="button" onClick={() => void refetch()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
              </div>
            ) : isLoading ? (
              <div className="rounded-xl border p-8 text-center text-xs text-muted-foreground">Loading persisted configuration records…</div>
            ) : configRecords.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-10 text-center">
                <AlertTriangle className="mx-auto h-7 w-7 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-bold">No configuration records returned</h3>
                <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">
                  Nothing is populated from an invented default. A platform administrator must initialize approved SystemConfig records before values can be changed here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {configRecords.map((item) => {
                  const isDirty = Boolean(dirty[item.key]);
                  const notConfigured = !item.configured;
                  return (
                    <div key={item.key} className="rounded-xl border bg-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="break-words text-xs font-extrabold">{item.key}</h3>
                          <p className="mt-1 text-[11px] text-muted-foreground">{DESCRIPTIONS[item.key] || 'System parameter stored in the configuration table.'}</p>
                        </div>
                        <span className="shrink-0 rounded-full border px-2 py-1 text-[9px] font-bold">{item.valueType}</span>
                      </div>
                      {notConfigured && <p className="text-[10px] font-semibold text-amber-700">NOT CONFIGURED — entering a value will create the record.</p>}
                      {item.valueType === 'BOOLEAN' ? (
                        <label className="flex items-center justify-between rounded-lg border p-3 text-xs">
                          <span>{draftValues[item.key] ? 'Enabled' : 'Disabled'}</span>
                          <input type="checkbox" checked={Boolean(draftValues[item.key])} disabled={!canEdit} onChange={(event) => handleChange(item.key, event.target.checked)} className="h-4 w-4 accent-primary disabled:opacity-50" />
                        </label>
                      ) : item.valueType === 'JSON' ? (
                        <textarea value={String(draftValues[item.key] ?? '')} disabled={!canEdit} onChange={(event) => handleChange(item.key, event.target.value)} rows={4} className="w-full rounded-lg border bg-background p-3 font-mono text-xs disabled:bg-muted" placeholder="Enter valid JSON" />
                      ) : (
                        <input
                          type={item.valueType === 'NUMBER' ? 'number' : 'text'}
                          value={String(draftValues[item.key] ?? '')}
                          disabled={!canEdit}
                          onChange={(event) => handleChange(item.key, item.valueType === 'NUMBER' ? (event.target.value === '' ? '' : Number(event.target.value)) : event.target.value)}
                          className="w-full rounded-lg border bg-background p-2.5 text-xs disabled:bg-muted"
                          placeholder={'Enter ' + item.key}
                        />
                      )}
                      <div className="flex items-center justify-between gap-2 border-t pt-2 text-[10px] text-muted-foreground">
                        <span>{item.isPublic ? 'Public to authenticated config consumers' : 'Restricted configuration'}</span>
                        <span>{isDirty ? 'Unsaved change' : item.configured ? 'Persisted' : 'Not persisted'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'FLAGS' && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold">Persisted feature flags</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{configuredFlagCount} enabled of {flags.length} configured flags.</p>
              </div>
            </div>
            {flagsError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">Feature flags could not be loaded.</p>
                <button type="button" onClick={() => void refetchFlags()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
              </div>
            ) : flagsLoading ? (
              <div className="rounded-xl border p-8 text-center text-xs text-muted-foreground">Loading persisted feature flags…</div>
            ) : flags.length === 0 ? (
              <div className="rounded-xl border border-dashed bg-card p-10 text-center">
                <AlertTriangle className="mx-auto h-7 w-7 text-muted-foreground" />
                <h3 className="mt-3 text-sm font-bold">No feature flags configured</h3>
                <p className="mt-1 text-xs text-muted-foreground">No invented sample flags are displayed. Initialize approved feature flag records before toggling rollout behavior.</p>
              </div>
            ) : flags.map((flag: any) => (
              <div key={flag.id} className="rounded-xl border bg-card p-4 flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-mono text-xs font-bold text-primary">{flag.key}</span>
                    <span className="rounded bg-muted px-2 py-0.5 text-[9px] font-bold border">{flag.environment || 'GLOBAL'}</span>
                  </div>
                  <h4 className="text-sm font-bold">{flag.name || flag.key}</h4>
                  <p className="text-xs text-muted-foreground">{flag.description || 'No description configured.'}</p>
                  {flag.updatedAt && <p className="text-[10px] text-muted-foreground">Updated {new Date(flag.updatedAt).toLocaleString('en-IN')}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => toggleFlag({ id: flag.id, isEnabled: !flag.isEnabled })}
                  disabled={!canEdit || isUpdatingFlag}
                  title={!canEdit ? 'Platform super-administrator permission required' : 'Persist feature flag state'}
                  aria-label={(flag.isEnabled ? 'Disable ' : 'Enable ') + flag.key}
                  className="self-start sm:self-auto p-2 disabled:opacity-50"
                >
                  {flag.isEnabled ? <ToggleRight className="h-8 w-8 text-emerald-500" /> : <ToggleLeft className="h-8 w-8 text-muted-foreground" />}
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
