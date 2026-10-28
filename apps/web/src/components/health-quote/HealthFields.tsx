'use client';

import React from 'react';
import type { FieldSpec } from './healthFormConfig';

export const inputCls =
  'w-full p-2 rounded-lg border border-border text-xs font-semibold bg-background focus:outline-none focus:ring-1 focus:ring-primary';

export function FieldLabel({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-foreground mb-1">
        {label}
        {required ? <span className="text-rose-500 ml-0.5">*</span> : <span className="text-muted-foreground text-[9px] ml-1">(Optional)</span>}
      </label>
      {children}
      {hint && <p className="text-[9px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export function YesNo({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      {[true, false].map((option) => (
        <button
          key={String(option)}
          type="button"
          onClick={() => onChange(option)}
          className={`px-4 py-1.5 rounded-lg border text-xs font-bold ${
            value === option ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
          }`}
        >
          {option ? 'Yes' : 'No'}
        </button>
      ))}
    </div>
  );
}

/** Renders a list of FieldSpec definitions (Section A, renewal fields) as a two-column form. */
export function HealthFields({
  fields,
  values,
  onChange,
}: {
  fields: FieldSpec[];
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}) {
  const set = (key: string, value: any) => onChange({ ...values, [key]: value });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {fields
        .filter((f) => !f.showIf || f.showIf(values))
        .map((f) => (
          <div key={f.key} className={f.type === 'multiselect' ? 'sm:col-span-2' : undefined}>
            <FieldLabel label={f.label} required={f.required} hint={f.hint}>
              {f.type === 'select' && (
                <select className={inputCls} value={values[f.key] ?? ''} onChange={(e) => set(f.key, e.target.value)}>
                  <option value="">-- Select --</option>
                  {f.options!.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              )}
              {f.type === 'multiselect' && (
                <div className="flex flex-wrap gap-2">
                  {f.options!.map((o) => {
                    const selected: string[] = values[f.key] ?? [];
                    const on = selected.includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => set(f.key, on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                        className={`px-3 py-1.5 rounded-full border text-[11px] font-bold ${
                          on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                        }`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              )}
              {f.type === 'boolean' && <YesNo value={Boolean(values[f.key])} onChange={(v) => set(f.key, v)} />}
              {(f.type === 'text' || f.type === 'number' || f.type === 'date') && (
                <input
                  className={inputCls}
                  type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                  min={f.type === 'number' ? 0 : undefined}
                  value={values[f.key] ?? ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </FieldLabel>
          </div>
        ))}
    </div>
  );
}
