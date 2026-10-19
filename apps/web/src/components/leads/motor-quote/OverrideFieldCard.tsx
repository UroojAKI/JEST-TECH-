'use client';

import React from 'react';

export interface OverrideFieldCardProps {
  label: string;
  value: string;
  status: 'MANUAL' | 'RECALCULATED' | 'CALCULATED';
  mandatory?: boolean;
  hint?: string;
  placeholder?: string;
  onChange: (val: string) => void;
  onReset?: () => void;
  accentColor?: string;
  disabled?: boolean;
  min?: number;
  step?: number | string;
}

export function OverrideFieldCard({
  label,
  value,
  status,
  mandatory,
  hint,
  placeholder,
  onChange,
  onReset,
  accentColor,
  disabled = false,
  min = 0,
  step = 1,
}: OverrideFieldCardProps) {
  const inputBase =
    'w-full p-2 text-xs font-bold rounded-lg border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-xs transition-colors';
  const mandatoryInput = (val: string) =>
    `${inputBase} ${!val || val === '' || val === '0' ? 'border-amber-400 bg-amber-50/20 dark:bg-amber-900/10' : 'border-border'}`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-1">
        <label className="text-[11px] font-bold text-foreground truncate">
          {label} {mandatory && <span className="text-rose-500">*</span>}
        </label>
        <div className="flex items-center gap-1.5 shrink-0">
          {status === 'MANUAL' && (
            <>
              <span className="text-[9px] font-black bg-amber-500/20 text-amber-600 px-1.5 py-0.5 rounded border border-amber-500/30">
                [Manually Overridden]
              </span>
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  disabled={disabled}
                  className="text-[9px] text-muted-foreground hover:text-foreground underline cursor-pointer disabled:opacity-50"
                >
                  Reset
                </button>
              )}
            </>
          )}
          {status === 'RECALCULATED' && (
            <span className="text-[9px] font-black bg-blue-500/20 text-blue-600 px-1.5 py-0.5 rounded border border-blue-500/30">
              [Recalculated]
            </span>
          )}
          {status === 'CALCULATED' && (
            <span className="text-[9px] font-medium bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              [Calculated]
            </span>
          )}
        </div>
      </div>
      <input
        type="number"
        step={step}
        min={min}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${mandatory ? mandatoryInput(value) : inputBase} ${accentColor || ''}`}
        placeholder={placeholder || '₹0'}
      />
      {hint && <p className="text-[9px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}
