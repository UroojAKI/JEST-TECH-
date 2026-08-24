'use client';

import React from 'react';
import { VEHICLE_FIELDS } from './motorFormConfig';
import type { VehicleCategory } from './motorFormTypes';

interface Props {
  category: VehicleCategory;
  data: Record<string, string>;
  onChange: (data: Record<string, string>) => void;
}

const inputBase = 'w-full px-3 py-2 rounded-md border text-sm font-medium bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors shadow-sm';

export function VehicleDetailsForm({ category, data, onChange }: Props) {
  const fields = VEHICLE_FIELDS[category];
  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [key]: e.target.value });

  return (
    <div className="space-y-6">
      {/* Vehicle Status Toggle */}
      <div className="bg-muted/50 p-4 rounded-lg border border-border">
        <label className="block text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Vehicle Registration Status
        </label>
        <div className="flex gap-4">
          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${data.vehicleStatus === 'NEW' ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted'}`}>
            <input
              type="radio"
              name="vehicleStatus"
              value="NEW"
              checked={data.vehicleStatus === 'NEW'}
              onChange={set('vehicleStatus')}
              className="sr-only"
            />
            Brand New Vehicle
          </label>
          <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-md border cursor-pointer transition-colors ${(!data.vehicleStatus || data.vehicleStatus === 'EXISTING') ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-muted'}`}>
            <input
              type="radio"
              name="vehicleStatus"
              value="EXISTING"
              checked={!data.vehicleStatus || data.vehicleStatus === 'EXISTING'}
              onChange={set('vehicleStatus')}
              className="sr-only"
            />
            Previously Registered (Existing)
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((f) => {
          // If NEW, hide registration number
          if (data.vehicleStatus === 'NEW' && f.key === 'registrationNumber') return null;
          const val = data[f.key] || '';
          const isMandatory = f.mandatory === true;
          const isConditional = f.mandatory === 'conditional';
          const hasError = isMandatory && !val;
          const borderCls = hasError ? 'border-destructive focus:ring-destructive/50' : 'border-border';

          return (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                {f.label}
                {isMandatory && <span className="text-destructive ml-1">*</span>}
                {isConditional && (
                  <span className="text-amber-600 text-[10px] ml-1 font-medium">(Conditional)</span>
                )}
                {!isMandatory && !isConditional && (
                  <span className="text-muted-foreground/60 text-[10px] ml-1 font-medium">(Optional)</span>
                )}
              </label>

              {f.type === 'dropdown' ? (
                <select
                  value={val}
                  onChange={set(f.key)}
                  className={`${inputBase} ${borderCls}`}
                >
                  <option value="">— Select —</option>
                  {(f.options || []).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : f.type === 'date' ? (
                <input
                  type="month"
                  value={val}
                  onChange={set(f.key)}
                  className={`${inputBase} ${borderCls}`}
                />
              ) : f.type === 'boolean' ? (
                <div className="flex gap-4 mt-1">
                  {['Yes', 'No'].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                      <input
                        type="radio"
                        name={f.key}
                        value={opt}
                        checked={val === opt}
                        onChange={set(f.key)}
                        className="h-4 w-4 text-primary focus:ring-primary/50"
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  type={f.type === 'numeric' ? 'number' : 'text'}
                  value={val}
                  onChange={set(f.key)}
                  placeholder={f.placeholder || ''}
                  className={`${inputBase} ${borderCls} ${
                    f.key === 'registrationNumber' ? 'uppercase font-mono tracking-wider' : ''
                  }`}
                />
              )}

              {f.hint && <p className="text-[11px] text-muted-foreground mt-1">{f.hint}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
