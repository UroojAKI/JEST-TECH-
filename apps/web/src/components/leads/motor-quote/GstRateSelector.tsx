'use client';

import React from 'react';

interface Props {
  value?: string | number;
  onChange: (rate: '5' | '18') => void;
  disabled?: boolean;
}

export function GstRateSelector({ value, onChange, disabled }: Props) {
  const current = String(value || '18') === '5' ? '5' : '18';

  return (
    <div className="p-3.5 rounded-xl border bg-muted/10 space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-[11px] font-black text-foreground block">
            Applicable GST Rate Selector
          </label>
          <span className="text-[10px] text-muted-foreground block">
            Select statutory GST rate. Component-level GST and total payable recalculate automatically.
          </span>
        </div>
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-background border self-start sm:self-auto shadow-xs">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('5')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              current === '5'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            5% GST
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('18')}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              current === '18'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            18% GST (Standard)
          </button>
        </div>
      </div>
    </div>
  );
}
