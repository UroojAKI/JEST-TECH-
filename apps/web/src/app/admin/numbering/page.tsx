'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Hash, Save, Loader2, RefreshCw, Lock, PlusCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useNumberSeries } from '../../../hooks/useAdmin';
import { adminRepository, NumberSeriesItem } from '../../../repositories/admin.repository';
import { useAuthStore } from '../../../store/auth-store';

type NumberFormatDraft = { prefix: string; format: string; padding: number };

function renderPreview(format: string, prefix: string, padding: number, periodLabel: string, nextSequence: number) {
  const parts = periodLabel.split('-');
  const year = parts[0] || String(new Date().getFullYear());
  const month = parts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
  return format
    .replaceAll('{PREFIX}', prefix)
    .replaceAll('{YYYY}', year)
    .replaceAll('{MM}', month)
    .replaceAll('{SEQUENCE}', String(nextSequence).padStart(padding, '0'));
}

export default function NumberSeriesPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { data: numberSeries = [], isLoading, isError, refetch, isFetching } = useNumberSeries();
  const [drafts, setDrafts] = useState<Record<string, NumberFormatDraft>>({});
  const [savingEntity, setSavingEntity] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEntityType, setNewEntityType] = useState('');
  const [newPrefix, setNewPrefix] = useState('');
  const [newFormat, setNewFormat] = useState('{PREFIX}-{YYYY}-{MM}-{SEQUENCE}');
  const [newPadding, setNewPadding] = useState(6);

  const canEdit = Array.isArray((user as any)?.permissions) && (user as any).permissions.includes('*');
  const rows: NumberSeriesItem[] = Array.isArray(numberSeries)
    ? numberSeries
    : Array.isArray((numberSeries as any)?.data) ? (numberSeries as any).data : [];

  useEffect(() => {
    const next: Record<string, NumberFormatDraft> = {};
    rows.forEach((row) => {
      next[row.entityType] = {
        prefix: row.prefix || '',
        format: row.format || '{PREFIX}-{YYYY}-{MM}-{SEQUENCE}',
        padding: Number(row.padding) || 6,
      };
    });
    setDrafts(next);
  }, [numberSeries]);

  const updateDraft = (entityType: string, field: keyof NumberFormatDraft, value: string | number) => {
    setDrafts((previous) => ({
      ...previous,
      [entityType]: { ...(previous[entityType] || { prefix: '', format: '', padding: 6 }), [field]: value },
    }));
  };

  const saveFormat = async (entityType: string, draft: NumberFormatDraft) => {
    if (!canEdit) {
      toast.error('Only a platform super-administrator can change global numbering formats.');
      return;
    }
    setSavingEntity(entityType);
    try {
      await adminRepository.updateNumberSeries(entityType, {
        prefix: draft.prefix.trim().toUpperCase(),
        format: draft.format.trim(),
        padding: Number(draft.padding),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-number-series'] });
      toast.success(entityType + ' numbering format saved. Existing issued identifiers are unchanged.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not save numbering format');
    } finally {
      setSavingEntity(null);
    }
  };

  const createSeries = async (event: React.FormEvent) => {
    event.preventDefault();
    const entityType = newEntityType.trim().toUpperCase();
    if (!entityType || !newPrefix.trim() || !newFormat.trim()) {
      toast.error('Entity type, prefix, and format are required.');
      return;
    }
    await saveFormat(entityType, { prefix: newPrefix.trim(), format: newFormat.trim(), padding: Number(newPadding) });
    setShowCreateForm(false);
    setNewEntityType('');
    setNewPrefix('');
    setNewFormat('{PREFIX}-{YYYY}-{MM}-{SEQUENCE}');
    setNewPadding(6);
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Hash className="h-5 w-5 text-primary" /> Numbering Format Configuration
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              These values come from the persisted numbering-format and sequence tables. Counters are currently partitioned by calendar year and month (YYYY-MM), not the Indian financial year. Preview shows the next sequence value for that period.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refetch()} disabled={isFetching} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">
              <RefreshCw className={'h-3.5 w-3.5 ' + (isFetching ? 'animate-spin' : '')} /> Refresh
            </button>
            {canEdit && (
              <button type="button" onClick={() => setShowCreateForm((show) => !show)} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                <PlusCircle className="h-3.5 w-3.5" /> Add series
              </button>
            )}
          </div>
        </div>

        {!canEdit && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs">
            <Lock className="mt-0.5 h-4 w-4 text-amber-700" />
            <p>Number formats are global in the current database schema. This account can inspect them but cannot edit global numbering; platform super-administrator permission is required.</p>
          </div>
        )}

        {showCreateForm && canEdit && (
          <form onSubmit={createSeries} className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="text-sm font-bold">Create numbering format</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Entity type</label>
                <input value={newEntityType} onChange={(event) => { setNewEntityType(event.target.value.toUpperCase()); if (!newPrefix || newPrefix === newEntityType.slice(0, 4)) setNewPrefix(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()); }} placeholder="e.g. POLICY" className="w-full rounded-lg border bg-background p-2 text-xs font-mono" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Prefix</label>
                <input value={newPrefix} onChange={(event) => setNewPrefix(event.target.value.toUpperCase())} className="w-full rounded-lg border bg-background p-2 text-xs font-mono" maxLength={12} required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Padding digits</label>
                <input type="number" value={newPadding} onChange={(event) => setNewPadding(Number(event.target.value))} min={1} max={12} className="w-full rounded-lg border bg-background p-2 text-xs" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-muted-foreground">Format</label>
                <input value={newFormat} onChange={(event) => setNewFormat(event.target.value)} className="w-full rounded-lg border bg-background p-2 text-xs font-mono" required />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Allowed placeholders: {'{PREFIX}'}, {'{YYYY}'}, {'{MM}'}, {'{SEQUENCE}'}. Prefix and sequence are required.</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreateForm(false)} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancel</button>
              <button type="submit" disabled={savingEntity !== null} className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                {savingEntity === newEntityType.toUpperCase() ? 'Saving…' : 'Create format'}
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading persisted numbering configuration…</div>
        ) : isError ? (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="font-semibold">Numbering configuration failed to load.</p>
            <p className="mt-1 text-xs text-muted-foreground">No example series are inserted as fallback data.</p>
            <button type="button" onClick={() => void refetch()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Hash className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-bold">No numbering formats persisted</h2>
            <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">The numbering engine may create an initial default format when an entity first requests a number. No sample series are shown until a format exists.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {rows.map((row) => {
              const draft = drafts[row.entityType] || { prefix: row.prefix, format: row.format, padding: row.padding };
              const preview = renderPreview(draft.format, draft.prefix, draft.padding, row.periodLabel, Number(row.currentSequence) + 1);
              const changed = draft.prefix !== row.prefix || draft.format !== row.format || Number(draft.padding) !== Number(row.padding);
              return (
                <section key={row.entityType} className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
                    <div>
                      <h2 className="text-sm font-bold">{row.entityType}</h2>
                      <p className="mt-1 text-[10px] text-muted-foreground">Active period: {row.periodLabel}</p>
                    </div>
                    <div className="min-w-[220px] rounded-lg border bg-primary/5 p-3">
                      <div className="text-[9px] font-bold uppercase text-muted-foreground">Next number preview</div>
                      <div className="mt-1 break-all font-mono text-sm font-black text-primary">{preview}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Prefix</label>
                      <input value={draft.prefix} disabled={!canEdit || savingEntity === row.entityType} onChange={(event) => updateDraft(row.entityType, 'prefix', event.target.value.toUpperCase())} maxLength={12} className="w-full rounded-lg border bg-background p-2 text-xs font-mono disabled:bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Padding digits</label>
                      <input type="number" min={1} max={12} value={draft.padding} disabled={!canEdit || savingEntity === row.entityType} onChange={(event) => updateDraft(row.entityType, 'padding', Number(event.target.value))} className="w-full rounded-lg border bg-background p-2 text-xs disabled:bg-muted" />
                    </div>
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Format template</label>
                      <input value={draft.format} disabled={!canEdit || savingEntity === row.entityType} onChange={(event) => updateDraft(row.entityType, 'format', event.target.value)} maxLength={120} className="w-full rounded-lg border bg-background p-2 text-xs font-mono disabled:bg-muted" />
                      <p className="text-[10px] text-muted-foreground">Allowed placeholders: {'{PREFIX}'}, {'{YYYY}'}, {'{MM}'}, {'{SEQUENCE}'}.</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <div className="text-[10px] text-muted-foreground">Current period counter: <strong className="text-foreground">{row.currentSequence}</strong>. Changes affect future numbers only.</div>
                    {canEdit && (
                      <button type="button" onClick={() => void saveFormat(row.entityType, draft)} disabled={!changed || savingEntity === row.entityType} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-40">
                        {savingEntity === row.entityType ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        Save format
                      </button>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
