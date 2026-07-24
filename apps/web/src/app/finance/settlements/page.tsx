'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Plus, Download } from 'lucide-react';
import { useSettlements } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';

export default function SettlementsWorkspacePage() {
  const { data: settlements = [] } = useSettlements();

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Insurer Net Payable Settlement Cockpit
          </h1>
          <p className="text-xs text-muted-foreground">Calculate net insurer payables (Gross Premium Collected - Retained Commission) & generate settlement batches</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Launching Create Insurer Settlement Batch Drawer...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create Settlement Batch</span>
          </button>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Insurer Partner</th>
              <th className="p-3">Settlement Period</th>
              <th className="p-3">Gross Premium Collected</th>
              <th className="p-3">Brokerage Retained</th>
              <th className="p-3">Net Insurer Payable</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Settled Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {settlements.map((s) => (
              <tr key={s.id} className="hover:bg-accent/40">
                <td className="p-3 font-bold text-foreground">{s.insurerName}</td>
                <td className="p-3 text-muted-foreground">{s.period}</td>
                <td className="p-3 font-mono">₹{s.grossPremiumCollected.toLocaleString('en-IN')}</td>
                <td className="p-3 font-mono text-emerald-600 font-bold">₹{s.commissionRetained.toLocaleString('en-IN')}</td>
                <td className="p-3 font-extrabold text-primary font-mono">₹{s.netPayable.toLocaleString('en-IN')}</td>
                <td className="p-3"><StatusBadge status={s.status} /></td>
                <td className="p-3 text-right font-mono text-muted-foreground">{s.settledDate || 'Pending'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
