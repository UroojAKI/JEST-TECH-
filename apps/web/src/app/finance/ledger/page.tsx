'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { BookOpen, Plus, Shield } from 'lucide-react';
import { useLedgerEntries } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';

export default function DoubleEntryLedgerPage() {
  const { ledgerEntries } = useLedgerEntries();

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" /> Double-Entry General Ledger Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Chart of Accounts, debit/credit journal entries, and automated financial balance validation</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => alert('Opening New Journal Entry Posting Form...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Post Journal Entry</span>
          </button>
        </div>
      </div>

      {/* Chart of Accounts Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Assets A/C</span>
          <div className="font-extrabold text-foreground text-sm">₹12,450,000</div>
          <span className="text-[10px] text-emerald-600 font-semibold">Debit Balance</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Liabilities A/C</span>
          <div className="font-extrabold text-amber-600 text-sm">₹310,000</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Credit Balance</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Revenue A/C</span>
          <div className="font-extrabold text-emerald-600 text-sm">₹4,850,000</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Credit Balance</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Expenses A/C</span>
          <div className="font-extrabold text-primary text-sm">₹485,000</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Debit Balance</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] font-bold uppercase text-muted-foreground">Equity A/C</span>
          <div className="font-extrabold text-foreground text-sm">₹6,805,000</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Credit Balance</span>
        </div>
      </div>

      {/* Journal Entries List */}
      <div className="space-y-4 text-xs">
        <h3 className="font-bold text-sm">Posted Journal Entries</h3>
        {ledgerEntries.map((je) => (
          <div key={je.id} className="p-4 rounded-xl border bg-card space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <div>
                <span className="font-bold text-primary font-mono text-sm">{je.entryNumber}</span>
                <span className="ml-2 text-muted-foreground">({je.date})</span>
                <p className="font-semibold text-xs mt-0.5">{je.description}</p>
              </div>
              <StatusBadge status={je.status} />
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="bg-muted/30 text-[10px] text-muted-foreground font-bold border-b uppercase">
                    <th className="p-2">Account Name</th>
                    <th className="p-2">Type</th>
                    <th className="p-2 text-right">Debit (Dr)</th>
                    <th className="p-2 text-right">Credit (Cr)</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono">
                  {je.lines.map((l, idx) => (
                    <tr key={idx}>
                      <td className="p-2 font-semibold font-sans">{l.accountName}</td>
                      <td className="p-2 text-muted-foreground font-sans">{l.accountType}</td>
                      <td className="p-2 text-right font-bold text-foreground">
                        {l.debit > 0 ? `₹${l.debit.toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="p-2 text-right font-bold text-foreground">
                        {l.credit > 0 ? `₹${l.credit.toLocaleString('en-IN')}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
