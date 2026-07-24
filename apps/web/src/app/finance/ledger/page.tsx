'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { BookOpen, Plus, Shield } from 'lucide-react';
import { useLedgerEntries } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';

export default function DoubleEntryLedgerPage() {
  const { ledgerEntries } = useLedgerEntries();
  const [showForm, setShowForm] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [description, setDescription] = useState('');
  const [debitAccount, setDebitAccount] = useState('BANK_ACCOUNT');
  const [creditAccount, setCreditAccount] = useState('PREMIUM_INCOME');
  const [amount, setAmount] = useState<number>(0);
  const [narration, setNarration] = useState('');

  const handlePostEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPosting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsPosting(false);
      setShowForm(false);
      toast.success('Journal entry posted successfully!');
      
      // Reset form
      setDescription('');
      setDebitAccount('BANK_ACCOUNT');
      setCreditAccount('PREMIUM_INCOME');
      setAmount(0);
      setNarration('');
    }, 1000);
  };

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
            onClick={() => setShowForm(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>+ Post Journal Entry</span>
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handlePostEntry} className="p-4 border rounded-xl bg-card space-y-4">
          <h3 className="font-bold text-sm">New Journal Entry</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Description</label>
              <input
                required
                className="w-full p-2 border rounded-md bg-background"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Daily Premium Collection"
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
              <label className="font-semibold">Debit Account</label>
              <select 
                className="w-full p-2 border rounded-md bg-background"
                value={debitAccount}
                onChange={(e) => setDebitAccount(e.target.value)}
              >
                <option value="BANK_ACCOUNT">BANK_ACCOUNT</option>
                <option value="PREMIUM_INCOME">PREMIUM_INCOME</option>
                <option value="COMMISSION_EXPENSE">COMMISSION_EXPENSE</option>
                <option value="INSURER_PAYABLE">INSURER_PAYABLE</option>
                <option value="AGENT_PAYABLE">AGENT_PAYABLE</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="font-semibold">Credit Account</label>
              <select 
                className="w-full p-2 border rounded-md bg-background"
                value={creditAccount}
                onChange={(e) => setCreditAccount(e.target.value)}
              >
                <option value="BANK_ACCOUNT">BANK_ACCOUNT</option>
                <option value="PREMIUM_INCOME">PREMIUM_INCOME</option>
                <option value="COMMISSION_EXPENSE">COMMISSION_EXPENSE</option>
                <option value="INSURER_PAYABLE">INSURER_PAYABLE</option>
                <option value="AGENT_PAYABLE">AGENT_PAYABLE</option>
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="font-semibold">Narration</label>
              <textarea
                className="w-full p-2 border rounded-md bg-background"
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                placeholder="Additional notes..."
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
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {isPosting ? 'Posting...' : 'Post Entry'}
            </button>
          </div>
        </form>
      )}

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

