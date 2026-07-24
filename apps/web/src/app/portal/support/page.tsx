'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { HelpCircle, Plus, BookOpen, ShieldCheck, CheckCircle2 } from 'lucide-react';

export default function AgentSupportPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" /> Support Desk & POSP Training Center
          </h1>
          <p className="text-xs text-muted-foreground">Raise branch support tickets, view POSP certification status, and access product training videos</p>
        </div>

        <button
          onClick={() => alert('Opening Support Ticket Form...')}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>+ Raise Support Ticket</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> POSP Certification Status
          </h3>
          <div className="p-3 rounded-xl border bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold flex justify-between items-center">
            <span>IRDAI POSP License Active</span>
            <span className="font-mono text-xs">CERT-881200</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
            <BookOpen className="h-4 w-4 text-primary" /> Product Training Modules
          </h3>
          <div className="space-y-1.5">
            <div className="flex justify-between font-bold"><span>Motor Underwriting & Addons 101</span><span className="text-emerald-600">✓ Completed</span></div>
            <div className="flex justify-between font-bold"><span>Group Health Optima Masterclass</span><span className="text-emerald-600">✓ Completed</span></div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
