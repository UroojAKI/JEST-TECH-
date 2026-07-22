'use client';

import React from 'react';
import { HeartPulse, CheckCircle2, ChevronRight } from 'lucide-react';

export function CustomerHealthStepper() {
  const journeyStages = [
    { label: 'Lead', completed: true },
    { label: 'Quote', completed: true },
    { label: 'Proposal', completed: true },
    { label: 'Policy Active', completed: true, current: true },
    { label: 'Renewal', completed: false },
    { label: 'Claim Filed', completed: false },
    { label: 'Retention', completed: false },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Customer Health Score Widget */}
      <div className="lg:col-span-4 rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center space-x-2">
            <HeartPulse className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Customer Health Gauge</h3>
          </div>
          <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            92 / 100 • Excellent
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Renewal Probability</span>
            <div className="font-bold text-foreground">88%</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Claims Ratio</span>
            <div className="font-bold text-emerald-600">16.6%</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Lifetime Value (LTV)</span>
            <div className="font-bold text-foreground">₹2.45L</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Risk Score</span>
            <div className="font-bold text-emerald-600">Low (12/100)</div>
          </div>
        </div>
      </div>

      {/* Customer Journey Progress Stepper */}
      <div className="lg:col-span-8 rounded-xl border bg-card p-4 shadow-sm space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2">Customer Lifecycle Journey</h3>
        <div className="flex items-center justify-between overflow-x-auto py-2">
          {journeyStages.map((stage, idx) => (
            <React.Fragment key={stage.label}>
              <div className="flex flex-col items-center text-center space-y-1 min-w-[70px]">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    stage.current
                      ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
                      : stage.completed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    stage.current ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < journeyStages.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
