'use client';

import React from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

export const LIFECYCLE_STEPS = [
  'Assigned',
  'Contacted',
  'Need Analysis',
  'Vehicle Details',
  'Quotation',
  'Proposal',
  'Negotiation',
  'Payment',
  'Policy Issued',
  'Renewal Scheduled',
  'CRM Updated',
];

interface PersistentStepTrackerProps {
  currentStepIndex?: number;
  onStepClick?: (index: number) => void;
}

export function PersistentStepTracker({
  currentStepIndex = 4,
  onStepClick,
}: PersistentStepTrackerProps) {
  return (
    <div className="p-4 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
          Motor Insurance Policy Lifecycle • Active Case Step Tracker
        </span>
        <span className="text-[11px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-full">
          Step {currentStepIndex + 1} of {LIFECYCLE_STEPS.length}: {LIFECYCLE_STEPS[currentStepIndex]}
        </span>
      </div>

      <div className="flex items-center overflow-x-auto py-2 space-x-1 sm:space-x-2 scrollbar-none">
        {LIFECYCLE_STEPS.map((step, idx) => {
          const isDone = idx < currentStepIndex;
          const isCurrent = idx === currentStepIndex;

          return (
            <React.Fragment key={step}>
              <button
                type="button"
                onClick={() => onStepClick?.(idx)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isCurrent
                    ? 'bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/30 font-black scale-105'
                    : isDone
                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                    : 'bg-muted/40 text-muted-foreground hover:bg-accent'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                ) : isCurrent ? (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-primary-foreground fill-primary-foreground animate-pulse" />
                ) : (
                  <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                )}
                <span>{step}</span>
              </button>

              {idx < LIFECYCLE_STEPS.length - 1 && (
                <span className={`text-muted-foreground/40 font-bold text-xs ${isDone ? 'text-emerald-500' : ''}`}>
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
