'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Award, CheckCircle2, Shield } from 'lucide-react';
import { useCommissions } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';

export default function CommissionsWorkspacePage() {
  const { commissions = [], approveCommission, bulkApproveCommissions, isLoading, isError, isApproving, isBulkApproving } = useCommissions();

  const handleBulkApprove = async () => {
    const pendingCommissions = (Array.isArray(commissions) ? commissions : (((commissions as any)?.data || (commissions as any)?.items || []))).filter((c: any) => c.payoutStatus === 'PENDING_APPROVAL');
    if (pendingCommissions.length === 0) {
      toast.info('No pending commissions to approve.');
      return;
    }
    try {
      // The mutation hook owns authoritative success/error feedback and cache invalidation.
      await bulkApproveCommissions(pendingCommissions.map((c: any) => c.id));
    } catch {
      // useCommissions reports the API error; avoid duplicate or optimistic toasts here.
    }
  };

  if (isLoading) {
    return (
      <AppShell>
        <div className="p-8 text-center text-muted-foreground animate-pulse">Loading commissions...</div>
      </AppShell>
    );
  }

  if (isError) {
    return (
      <AppShell>
        <div className="p-8 text-center text-destructive">Error loading commissions. Please try again.</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" /> Agent Commission & Manager Override Engine
          </h1>
          <p className="text-xs text-muted-foreground">Multi-tier commission calculation, manager override rules, and payout approvals</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleBulkApprove}
            disabled={isApproving || isBulkApproving}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white shadow hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{isBulkApproving ? 'Approving...' : '✓ Bulk Approve Payouts'}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-xl border bg-card text-xs">
        <table className="w-full min-w-[980px] border-collapse text-left">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3">Policy No.</th>
              <th className="p-3">Recipient Name</th>
              <th className="p-3">Role Tier</th>
              <th className="p-3">Gross Premium</th>
              <th className="p-3">Rate %</th>
              <th className="p-3">Commission Amt</th>
              <th className="p-3">Accrual Status</th>
              <th className="p-3">Payout Status</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {commissions.length === 0 ? (
              <tr>
                <td colSpan={9} className="p-8 text-center text-muted-foreground">
                  No commissions found.
                </td>
              </tr>
            ) : (
              commissions.map((c: any) => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="p-3 font-mono font-bold text-primary">{c.policyNumber}</td>
                  <td className="p-3 font-semibold">{c.agentName}</td>
                  <td className="p-3 font-bold">
                    <span className="px-2 py-0.5 rounded bg-muted text-foreground border text-[10px]">
                      {c.roleTier}
                    </span>
                  </td>
                  <td className="p-3 font-mono">₹{c.grossPremium?.toLocaleString('en-IN') || 0}</td>
                  <td className="p-3 font-bold text-primary">{c.commissionPercent}%</td>
                  <td className="p-3 font-extrabold text-emerald-600 font-mono">
                    ₹{c.commissionAmount?.toLocaleString('en-IN') || 0}
                  </td>
                  <td className="p-3"><StatusBadge status={c.status} /></td>
                  <td className="p-3"><StatusBadge status={c.payoutStatus} /></td>
                  <td className="p-3 text-right">
                    {c.payoutStatus === 'PENDING_APPROVAL' ? (
                      <button
                        onClick={() => approveCommission(c.id)}
                        disabled={isApproving}
                        className="px-3 py-1.5 rounded bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 shadow disabled:opacity-50"
                      >
                        Approve Payout
                      </button>
                    ) : (
                      <span className="text-emerald-600 font-bold text-[10px]">✓ Disbursed</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
