'use client';

import React from 'react';
import { POLICY_TYPES } from './motorFormConfig';
import type { PolicyType } from './motorFormTypes';

interface Props {
  selected: PolicyType | null;
  onChange: (pt: PolicyType) => void;
}

const POLICY_COLORS: Record<PolicyType, string> = {
  TP_ONLY: 'border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  SAOD: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  PACKAGE: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
};

const POLICY_ICONS: Record<PolicyType, string> = {
  TP_ONLY: '🛡️',
  SAOD: '🔧',
  PACKAGE: '⚡',
};

export function PolicyTypeSelector({ selected, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-black text-sm text-foreground">Select Policy Type</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Three distinct products as per IRDAI Motor Insurance framework
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {POLICY_TYPES.map((pt) => {
          const isSelected = selected === pt.id;
          return (
            <button
              key={pt.id}
              type="button"
              onClick={() => onChange(pt.id as PolicyType)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? `${POLICY_COLORS[pt.id as PolicyType]} border-2 shadow-md ring-1 ring-offset-1`
                  : 'border-border bg-card hover:border-primary/40 hover:bg-accent'
              }`}
            >
              <div className="text-xl mb-2">{POLICY_ICONS[pt.id as PolicyType]}</div>
              <div className={`text-xs font-black leading-tight ${isSelected ? '' : 'text-foreground'}`}>
                {pt.short}
              </div>
              <div className={`text-[10px] mt-0.5 leading-snug ${isSelected ? 'opacity-80' : 'text-muted-foreground'}`}>
                {pt.description}
              </div>
              {isSelected && (
                <div className="mt-2 text-[9px] font-bold flex items-center gap-1">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Selected
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
