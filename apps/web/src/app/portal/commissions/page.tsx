'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { DollarSign, AlertTriangle, RefreshCw, Loader2, Info } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/status-badge';
import { useQuery } from '@tanstack/react-query';
import { apiClient, getApiErrorMessage } from '../../../lib/api-client';

interface CommissionRecord {
  id: string;
  policyId?: string;
  policyNumber?: string;
  customerName?: string;
  amount: number | string;
  commissionAmount?: number | string;
  status: string;
  payoutStatus?: string;
  roleTier?: string;
  createdAt: string;
}

export default function AgentCommissionsPage() {
  const {
    data: commissions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<CommissionRecord[]>({
    queryKey: ['agent-commissions-me'],
    queryFn: async () => {
      const res = await apiClient.get('/finance/commissions/me');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const totalEarned = commissions.reduce(
    (sum, c) => sum + Number(c.amount ?? c.commissionAmount ?? 0),
    0,
  );
  const approvedForPayout = commissions
    .filter((c) => c.status === 'APPROVED' || c.payoutStatus === 'APPROVED')
    .reduce((sum, c) => sum + Number(c.amount ?? c.commissionAmount ?? 0), 0);
  const paidOut = commissions
    .filter((c) => c.status === 'PAID' || c.payoutStatus === 'PAID')
    .reduce((sum, c) => sum + Number(c.amount ?? c.commissionAmount ?? 0), 0);
  const pendingApproval = commissions
    .filter((c) => c.status === 'ACCRUED' || c.payoutStatus === 'PENDING_APPROVAL')
    .reduce((sum, c) => sum + Number(c.amount ?? c.commissionAmount ?? 0), 0);

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" /> My Commission Ledger & Performance
          </h1>
          <p className="text-xs text-muted-foreground">
            Authoritative personal commission ledger, approved earnings, and payout status
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Total Earned</span>
          <div className="text-lg font-black text-emerald-600">
            ₹{totalEarned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Approved for Payout</span>
          <div className="text-lg font-black text-primary">
            ₹{approvedForPayout.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Disbursed / Paid</span>
          <div className="text-lg font-black text-foreground">
            ₹{paidOut.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Pending Review</span>
          <div className="text-lg font-black text-amber-600">
            ₹{pendingApproval.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span>Loading personal commission records...</span>
          </div>
        ) : isError ? (
          <div className="p-8 text-center bg-destructive/10 border-destructive/20 text-destructive space-y-3">
            <AlertTriangle className="h-6 w-6 mx-auto" />
            <div className="font-bold">Unable to load commission records</div>
            <p className="text-xs text-muted-foreground">{getApiErrorMessage(error)}</p>
            <button
              onClick={() => refetch()}
              className="px-3.5 py-1.5 rounded-lg bg-destructive text-destructive-foreground font-bold hover:bg-destructive/90 transition inline-flex items-center gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        ) : commissions.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground space-y-2">
            <Info className="h-6 w-6 mx-auto text-muted-foreground" />
            <div className="font-bold text-foreground">No Commission Records Found</div>
            <p className="text-xs max-w-sm mx-auto">
              You do not have any accrued or disbursed commission records in the current company context.
            </p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Reference / Policy</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Tier</th>
                <th className="p-3">Status</th>
                <th className="p-3">Earned Amount</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {commissions.map((c) => {
                const earned = Number(c.amount ?? c.commissionAmount ?? 0);
                return (
                  <tr key={c.id} className="hover:bg-accent/40">
                    <td className="p-3 font-mono font-bold text-primary">
                      {c.policyNumber || c.id.slice(0, 12)}
                    </td>
                    <td className="p-3 font-semibold">{c.customerName || 'Customer'}</td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-bold">
                        {c.roleTier || 'AGENT'}
                      </span>
                    </td>
                    <td className="p-3">
                      <StatusBadge status={c.payoutStatus || c.status} />
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-600">
                      ₹{earned.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-3 font-mono text-muted-foreground">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </AppShell>
  );
}
