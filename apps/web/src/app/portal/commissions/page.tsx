'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DollarSign } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface CommissionRecord {
  id: string;
  policyId: string;
  agentId: string;
  amount: number | string;
  status: string;
  type?: string;
  createdAt: string;
  policy?: {
    policyNumber?: string;
    contact?: { firstName?: string; lastName?: string };
    premiumAmount?: number;
  };
}

export default function AgentCommissionsPage() {
  const { data: commissions = [], isLoading } = useQuery<CommissionRecord[]>({
    queryKey: ['agent-commissions'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/commissions');
      return res.data || [];
    },
  });

  const totalEarned = commissions.reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const approvedForPayout = commissions
    .filter((c) => c.status === 'APPROVED')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const paidOut = commissions
    .filter((c) => c.status === 'PAID')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const overrides = commissions
    .filter((c) => c.type === 'OVERRIDE')
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

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
          <div className="text-lg font-black text-emerald-600">₹{totalEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Approved for Payout</span>
          <div className="text-lg font-black text-primary">₹{approvedForPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Paid Out This Month</span>
          <div className="text-lg font-black text-foreground">₹{paidOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Manager Overrides</span>
          <div className="text-lg font-black text-amber-600">₹{overrides.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading commission ledger...</div>
        ) : commissions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">No commission entries found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Reference</th>
                <th className="p-3">Status</th>
                <th className="p-3">Earned Amount</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {commissions.map((c) => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{c.id.slice(0, 12)}</td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3 font-mono font-bold text-emerald-600">₹{Number(c.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                  <td className="p-3 font-mono text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}

