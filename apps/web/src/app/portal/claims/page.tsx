'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { ShieldAlert, Plus, Eye, Clock, Upload } from 'lucide-react';

export default function AgentClaimsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" /> Customer Claims Follow-up Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Register customer claims, upload surveyor damage photos, and track settlement status</p>
        </div>

        <button
          onClick={() => alert('Opening Claim Intimation Drawer...')}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>+ Intimate New Claim</span>
        </button>
      </div>

      <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4 text-xs">
        <div className="flex justify-between items-center border-b pb-2">
          <span className="font-mono font-bold text-primary">CLM-2026-0042</span>
          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 font-bold text-[10px]">Surveyor Assigned</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>Customer: <strong>Acme Logistics Pvt Ltd</strong></div>
          <div>Policy No: <strong>POL-001049</strong></div>
          <div>Claim Reserve: <strong className="text-emerald-600">₹3,84,500</strong></div>
          <div>Surveyor: <strong>R. K. Gupta</strong></div>
        </div>

        <div className="space-y-2 pt-2 border-t">
          <h4 className="font-bold text-[10px] uppercase text-muted-foreground">Real-Time Claim Settlement Status Progress</h4>
          <div className="grid grid-cols-5 gap-2 text-center text-[10px]">
            {['1. Intimated', '2. Surveyor Assigned', '3. Inspection Done', '4. Approved', '5. Settled'].map((st, idx) => (
              <div key={idx} className={`p-2 rounded border font-bold ${idx <= 1 ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-muted/10 text-muted-foreground'}`}>
                {st}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
