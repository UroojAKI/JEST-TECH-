'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { BookOpen, Plus, Shield, CheckCircle2, AlertTriangle, Search, Loader2 } from 'lucide-react';
import { useLedgerEntries } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';

export default function DoubleEntryLedgerPage() {
  const [search, setSearch] = useState('');
  const [refFilter, setRefFilter] = useState('ALL');
  const { ledgerEntries, isLoading, postJournalEntry, isPosting } = useLedgerEntries({
    search,
    referenceType: refFilter,
  });

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState('acc-bank');
  const [creditAccount, setCreditAccount] = useState('acc-prem');
  const [amount, setAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      toast.error('Transaction amount must be greater than zero');
      return;
    }

    try {
      await postJournalEntry({
        date: new Date().toISOString(),
        description,
        lines: [
          { accountId: debitAccount, debit: amount, credit: 0, description: narration },
          { accountId: creditAccount, debit: 0, credit: amount, description: narration },
        ],
      });
      setShowForm(false);
      setDescription('');
      setAmount(0);
      setNarration('');
    } catch (err: any) {
      // Toast already fired in hook
    }
  };

  return (
    <AppShell activeWorkspace="FINANCE">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Double-Entry General Ledger Workspace (R12)
            </h1>
            <p className="text-xs text-muted-foreground">
              Strict multi-party double-entry balancing (Total Debits = Total Credits), Bank UTR audit trails, and financial reconciliation.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition"
            >
              <Plus className="h-4 w-4" />
              <span>+ Post Journal Entry</span>
            </button>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handlePostEntry} className="p-5 border rounded-2xl bg-card space-y-4 shadow-sm">
            <h3 className="font-bold text-sm">Post Balanced Double-Entry Journal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold">Description</label>
                <input
                  required
                  className="w-full p-2 border rounded-md bg-background"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Policy Premium Direct Bank Credit"
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
                <label className="font-semibold">Debit Account (Dr)</label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={debitAccount}
                  onChange={(e) => setDebitAccount(e.target.value)}
                >
                  <option value="acc-bank">HDFC Bank Clearing (Asset)</option>
                  <option value="acc-ar">Accounts Receivable - Customers (Asset)</option>
                  <option value="acc-comm-exp">Commission Expense (Expense)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-semibold">Credit Account (Cr)</label>
                <select
                  className="w-full p-2 border rounded-md bg-background"
                  value={creditAccount}
                  onChange={(e) => setCreditAccount(e.target.value)}
                >
                  <option value="acc-prem">Gross Written Premium Income (Revenue)</option>
                  <option value="acc-ap-insurer">Insurer Premium Payable (Liability)</option>
                  <option value="acc-comm-inc">Brokerage Commission Revenue (Revenue)</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold">Narration / UTR Reference</label>
                <textarea
                  className="w-full p-2 border rounded-md bg-background"
                  value={narration}
                  onChange={(e) => setNarration(e.target.value)}
                  placeholder="Bank UTR or transaction memo..."
                  rows={2}
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
                disabled={isPosting}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isPosting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{isPosting ? 'Posting...' : 'Post Entry'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by entry #, memo, or reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto p-1 bg-muted/40 rounded-xl border">
            {(['ALL', 'POLICY', 'RECEIPT', 'INVOICE', 'SETTLEMENT'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setRefFilter(type)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                  refFilter === type
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {type === 'ALL' ? 'All Types' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Journal Entries List */}
        <div className="space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm">General Ledger Double-Entry Audit Trail</h3>
            <span className="text-xs text-muted-foreground">{ledgerEntries.length} Posted Entries</span>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-card">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
              <span>Loading ledger journal entries...</span>
            </div>
          ) : ledgerEntries.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground border rounded-2xl bg-card">
              No journal entries found matching filters.
            </div>
          ) : (
            ledgerEntries.map((je: any) => (
              <div key={je.id} className="p-4 rounded-xl border bg-card space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-primary font-mono text-sm">{je.entryNumber}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(je.date).toLocaleDateString('en-IN')}
                      </span>
                      {je.isBalanced ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          BALANCED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                          <AlertTriangle className="h-3 w-3" />
                          UNBALANCED
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-xs mt-0.5">{je.description}</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={je.status} />
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                      Total: ₹{Number(je.totalDebit || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-muted/30 text-[10px] text-muted-foreground font-bold border-b uppercase">
                        <th className="p-2">Account Code & Name</th>
                        <th className="p-2">Type</th>
                        <th className="p-2 text-right">Debit (Dr)</th>
                        <th className="p-2 text-right">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y font-mono">
                      {je.lines?.map((l: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/10">
                          <td className="p-2 font-semibold font-sans">
                            <span className="font-mono text-muted-foreground mr-1.5">{l.accountCode}</span>
                            <span>{l.accountName}</span>
                          </td>
                          <td className="p-2 text-muted-foreground font-sans">{l.accountType}</td>
                          <td className="p-2 text-right font-bold text-foreground">
                            {l.debit > 0 ? `₹${Number(l.debit).toLocaleString('en-IN')}` : '-'}
                          </td>
                          <td className="p-2 text-right font-bold text-foreground">
                            {l.credit > 0 ? `₹${Number(l.credit).toLocaleString('en-IN')}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
