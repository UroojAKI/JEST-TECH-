'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DollarSign, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_COMMISSIONS = [
  { id: 'COMM-1001', policyNumber: 'POL-001048', customerName: 'Rahul Patil', totalPremium: 16545, commissionRate: 10, earnedAmount: 1654.5, payoutStatus: 'APPROVED', transactionDate: '2026-07-24' },
  { id: 'COMM-1002', policyNumber: 'POL-001049', customerName: 'Acme Logistics', totalPremium: 384000, commissionRate: 10, earnedAmount: 38400.0, payoutStatus: 'PAID', transactionDate: '2026-07-20' },
];

export default function AgentCommissionsPage() {
  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" /> Agent Commission Ledger & Overrides
          </h1>
          <p className="text-xs text-muted-foreground">Track policy commissions, manager overrides, performance incentives, and bank payout status</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Commission Earned MTD</span>
          <div className="text-lg font-black text-emerald-600">₹42,850.00</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Approved for Payout</span>
          <div className="text-lg font-black text-primary">₹1,654.50</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Paid Out This Month</span>
          <div className="text-lg font-black text-foreground">₹38,400.00</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Manager Overrides</span>
          <div className="text-lg font-black text-amber-600">₹2,800.00</div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Policy No</th>
              <th className="p-3">Customer Name</th>
              <th className="p-3">GWP Premium</th>
              <th className="p-3">Comm. Rate</th>
              <th className="p-3">Earned Amount</th>
              <th className="p-3">Payout Status</th>
              <th className="p-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {MOCK_COMMISSIONS.map((c) => (
              <tr key={c.id} className="hover:bg-accent/40">
                <td className="p-3 font-mono font-bold text-primary">{c.policyNumber}</td>
                <td className="p-3 font-semibold">{c.customerName}</td>
                <td className="p-3 font-mono">₹{c.totalPremium.toLocaleString('en-IN')}</td>
                <td className="p-3 font-bold">{c.commissionRate}%</td>
                <td className="p-3 font-mono font-bold text-emerald-600">₹{c.earnedAmount.toLocaleString('en-IN')}</td>
                <td className="p-3"><StatusBadge status={c.payoutStatus} /></td>
                <td className="p-3 font-mono text-muted-foreground">{c.transactionDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
