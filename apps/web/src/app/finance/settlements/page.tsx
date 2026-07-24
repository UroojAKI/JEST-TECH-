'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Building2, Plus, Download } from 'lucide-react';
import { useSettlements } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';

export default function SettlementsWorkspacePage() {
  const { data: settlements = [], isLoading, isError } = useSettlements();
  const [showForm, setShowForm] = useState(false);
  const [insurerName, setInsurerName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [period, setPeriod] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.info('Settlement batch submitted for processing!');
    setShowForm(false);
    setInsurerName('');
    setAmount(0);
    setPeriod('');
    setDescription('');
  };

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
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Create Settlement Batch</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="p-4 border rounded-xl bg-card space-y-4 my-4">
          <h3 className="font-bold text-sm">Create Settlement Batch</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Insurer Name</label>
              <input
                required
                className="w-full p-2 border rounded-md bg-background"
                value={insurerName}
                onChange={(e) => setInsurerName(e.target.value)}
                placeholder="e.g. HDFC ERGO"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Amount (₹)</label>
              <input
                required
                type="number"
                min="1"
                className="w-full p-2 border rounded-md bg-background"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Period</label>
              <input
                required
                className="w-full p-2 border rounded-md bg-background"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                placeholder="e.g. July 2026"
              />
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Description</label>
              <input
                className="w-full p-2 border rounded-md bg-background"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Notes..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-bold rounded-lg border hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
            >
              Submit Batch
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground animate-pulse mt-4">Loading settlements...</div>
      ) : isError ? (
        <div className="p-8 text-center text-destructive mt-4">Error loading settlements. Please try again.</div>
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card text-xs mt-4">
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
              {settlements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No settlements found.
                  </td>
                </tr>
              ) : (
                settlements.map((s: any) => (
                  <tr key={s.id} className="hover:bg-accent/40">
                    <td className="p-3 font-bold text-foreground">{s.insurerName}</td>
                    <td className="p-3 text-muted-foreground">{s.period}</td>
                    <td className="p-3 font-mono">₹{s.grossPremiumCollected?.toLocaleString('en-IN') || 0}</td>
                    <td className="p-3 font-mono text-emerald-600 font-bold">₹{s.commissionRetained?.toLocaleString('en-IN') || 0}</td>
                    <td className="p-3 font-extrabold text-primary font-mono">₹{s.netPayable?.toLocaleString('en-IN') || 0}</td>
                    <td className="p-3"><StatusBadge status={s.status} /></td>
                    <td className="p-3 text-right font-mono text-muted-foreground">{s.settledDate || 'Pending'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
