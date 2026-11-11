'use client';

import React, { useEffect, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Award, CheckCircle2, Shield } from 'lucide-react';
import { useCommissions } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { toast } from 'sonner';
import { apiClient, getApiErrorMessage } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/auth-store';

export default function CommissionsWorkspacePage() {
  const { commissions = [], approveCommission, bulkApproveCommissions, isLoading, isError, isApproving, isBulkApproving } = useCommissions();
  const user = useAuthStore((state) => state.user);
  const [plans, setPlans] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [agentPercent, setAgentPercent] = useState('10');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [payableAccountId, setPayableAccountId] = useState('');
  const canConfigurePlans = user?.role === 'ADMIN';

  const loadPlans = async () => {
    setPlansLoading(true);
    try {
      const [planResponse, accountResponse] = await Promise.all([
        apiClient.get('/finance/commissions/plans'),
        apiClient.get('/finance/accounts'),
      ]);
      setPlans(Array.isArray(planResponse.data) ? planResponse.data : []);
      setAccounts(Array.isArray(accountResponse.data) ? accountResponse.data : []);
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Unable to load commission plan configuration');
    } finally {
      setPlansLoading(false);
    }
  };

  useEffect(() => { void loadPlans(); }, []);

  const createPlan = async () => {
    if (!planName.trim() || !expenseAccountId || !payableAccountId) {
      toast.error('Enter a plan name and select both ledger accounts');
      return;
    }
    setSavingPlan(true);
    try {
      await apiClient.post('/finance/commissions/plans', {
        name: planName.trim(),
        description: planDescription.trim() || undefined,
        rules: {
          agentPercent: Number(agentPercent),
          overrides: [],
          accounting: { expenseAccountId, payableAccountId },
        },
      });
      setPlanName('');
      setPlanDescription('');
      toast.success('Commission plan created');
      await loadPlans();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Unable to create commission plan');
    } finally {
      setSavingPlan(false);
    }
  };

  const setPlanActive = async (plan: any, isActive: boolean) => {
    try {
      await apiClient.patch(`/finance/commissions/plans/${plan.id}`, { isActive });
      toast.success(isActive ? 'Commission plan activated' : 'Commission plan deactivated');
      await loadPlans();
    } catch (error) {
      toast.error(getApiErrorMessage(error) || 'Unable to update commission plan');
    }
  };

  const handleBulkApprove = async () => {
    const pendingCommissions = (Array.isArray(commissions) ? commissions : (((commissions as any)?.data || (commissions as any)?.items || []))).filter((c: any) => c.payoutStatus === 'PENDING_APPROVAL');
    if (pendingCommissions.length === 0) {
      toast.info('No pending commissions to approve.');
      return;
    }
    try {
      await bulkApproveCommissions(pendingCommissions.map((c: any) => c.id));
    } catch {
      // The mutation hook owns error feedback.
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

      <section className="mt-6 rounded-xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-sm">Commission plan configuration</h2>
            <p className="text-xs text-muted-foreground">Tenant-owned plans with explicit ledger mappings for automatic accrual posting.</p>
          </div>
          <button onClick={() => void loadPlans()} disabled={plansLoading} className="rounded border px-3 py-1.5 text-xs font-semibold disabled:opacity-50">Refresh</button>
        </div>
        {canConfigurePlans && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 items-end">
            <label className="text-xs space-y-1"><span className="font-semibold">Plan name</span><input value={planName} onChange={(e) => setPlanName(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" placeholder="Standard Motor Commission" /></label>
            <label className="text-xs space-y-1"><span className="font-semibold">Agent commission %</span><input type="number" min="0" max="15" step="0.1" value={agentPercent} onChange={(e) => setAgentPercent(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" /></label>
            <label className="text-xs space-y-1"><span className="font-semibold">Commission expense account</span><select value={expenseAccountId} onChange={(e) => setExpenseAccountId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">Select expense account</option>{accounts.filter((a) => a.type === 'EXPENSE').map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
            <label className="text-xs space-y-1"><span className="font-semibold">Commission payable account</span><select value={payableAccountId} onChange={(e) => setPayableAccountId(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2"><option value="">Select liability account</option>{accounts.filter((a) => a.type === 'LIABILITY').map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</select></label>
            <button onClick={createPlan} disabled={savingPlan || plansLoading} className="rounded-md bg-primary text-primary-foreground px-3 py-2 text-xs font-bold disabled:opacity-50">{savingPlan ? 'Saving…' : 'Create plan'}</button>
            <label className="text-xs space-y-1 md:col-span-2 xl:col-span-5"><span className="font-semibold">Description</span><input value={planDescription} onChange={(e) => setPlanDescription(e.target.value)} className="w-full rounded-md border bg-background px-3 py-2" placeholder="Optional description" /></label>
          </div>
        )}
        {plansLoading ? <p className="text-xs text-muted-foreground">Loading plans…</p> : plans.length === 0 ? <p className="text-xs text-muted-foreground">No company commission plans configured. Accrual remains blocked until a valid plan and ledger mapping exist.</p> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-lg border p-3 flex items-start justify-between gap-3">
                <div><div className="font-semibold text-sm">{plan.name}</div><p className="text-xs text-muted-foreground">{plan.description || 'No description'}</p><p className="text-xs mt-1">Agent rate: {plan.rules?.agentPercent ?? '—'}% · {plan.isActive ? 'Active' : 'Inactive'}</p></div>
                {canConfigurePlans && <button onClick={() => void setPlanActive(plan, !plan.isActive)} className="rounded border px-2 py-1 text-[11px] font-semibold">{plan.isActive ? 'Deactivate' : 'Activate'}</button>}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="border rounded-xl overflow-x-auto bg-card text-xs mt-4">
        <table className="w-full min-w-[980px] text-left border-collapse">
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
                    ) : c.payoutStatus === 'PAID' ? (
                      <span className="text-emerald-600 font-bold text-[10px]">Paid</span>
                    ) : c.payoutStatus === 'APPROVED' ? (
                      <span className="text-sky-600 font-bold text-[10px]">Approved · awaiting payout</span>
                    ) : c.integrityStatus === 'DATA_INTEGRITY_EXCEPTION' ? (
                      <span className="text-destructive font-bold text-[10px]">Review data integrity</span>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">No action available</span>
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
