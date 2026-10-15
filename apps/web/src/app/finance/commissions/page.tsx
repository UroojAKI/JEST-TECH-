'use client';

import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../../components/layout/app-shell';
import { Award, CheckCircle2, RefreshCw, PlusCircle, Pencil, Power, Lock, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { useCommissions } from '../../../hooks/useFinance';
import { StatusBadge } from '../../../components/ui/status-badge';
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/auth-store';
import { toast } from 'sonner';

type CommissionPlan = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  rules: any;
  rulesStatus?: string;
  updatedAt?: string;
};

function currency(value: unknown) {
  const number = Number(value);
  return value === null || value === undefined || !Number.isFinite(number)
    ? '—'
    : '₹' + number.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CommissionsWorkspacePage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'PLANS'>('LEDGER');
  const { commissions = [], approveCommission, isLoading, isError, isApproving } = useCommissions();
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [agentPercent, setAgentPercent] = useState('');
  const [maxAgentPercent, setMaxAgentPercent] = useState('');
  const [maxTotalPercent, setMaxTotalPercent] = useState('');
  const [overridesJson, setOverridesJson] = useState('[]');

  const permissions = Array.isArray((user as any)?.permissions) ? (user as any).permissions as string[] : [];
  const isPlatformAdmin = permissions.includes('*');
  const canReadPlans = isPlatformAdmin || permissions.includes('commission:read') || permissions.includes('commission:configure');
  const canManagePlans = isPlatformAdmin;

  const {
    data: plansResponse,
    isLoading: plansLoading,
    isError: plansError,
    refetch: refetchPlans,
    isFetching: plansFetching,
  } = useQuery({
    queryKey: ['finance-commission-plans'],
    queryFn: async () => {
      const response = await apiClient.get('/finance/commissions/plans');
      return response.data;
    },
    enabled: canReadPlans,
  });
  const plans: CommissionPlan[] = Array.isArray(plansResponse) ? plansResponse : [];

  const savePlanMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { id, ...data } = payload;
      const response = id
        ? await apiClient.put('/finance/commissions/plans/' + id, data)
        : await apiClient.post('/finance/commissions/plans', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-commission-plans'] });
      toast.success('Commission plan rules saved.');
      resetPlanForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to save commission plan'),
  });

  const togglePlanMutation = useMutation({
    mutationFn: async (id: string) => (await apiClient.patch('/finance/commissions/plans/' + id + '/toggle')).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-commission-plans'] });
      toast.success('Commission plan activation persisted.');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to update commission plan status'),
  });

  const commissionRows: any[] = Array.isArray(commissions)
    ? commissions
    : ((commissions as any)?.data || (commissions as any)?.items || []);
  const pendingCommissions = useMemo(
    () => commissionRows.filter((item: any) => item.payoutStatus === 'PENDING_APPROVAL'),
    [commissionRows],
  );

  function resetPlanForm() {
    setEditingPlanId(null);
    setPlanName('');
    setPlanDescription('');
    setAgentPercent('');
    setMaxAgentPercent('');
    setMaxTotalPercent('');
    setOverridesJson('[]');
    setShowPlanForm(false);
  }

  function openEditPlan(plan: CommissionPlan) {
    const rules = plan.rules && typeof plan.rules === 'object' ? plan.rules : {};
    setEditingPlanId(plan.id);
    setPlanName(plan.name || '');
    setPlanDescription(plan.description || '');
    setAgentPercent(rules.agentPercent == null ? '' : String(rules.agentPercent));
    setMaxAgentPercent(rules.maxAgentPercent == null ? '' : String(rules.maxAgentPercent));
    setMaxTotalPercent(rules.maxTotalPercent == null ? '' : String(rules.maxTotalPercent));
    setOverridesJson(JSON.stringify(Array.isArray(rules.overrides) ? rules.overrides : [], null, 2));
    setShowPlanForm(true);
  }

  function handleSavePlan(event: React.FormEvent) {
    event.preventDefault();
    if (!canManagePlans) {
      toast.error('Only a platform super-administrator can change global commission plans.');
      return;
    }
    let overrides: any[];
    try {
      overrides = JSON.parse(overridesJson);
      if (!Array.isArray(overrides)) throw new Error('Overrides must be a JSON array.');
    } catch (error: any) {
      toast.error(error?.message || 'Manager overrides must be valid JSON.');
      return;
    }
    const values = [agentPercent, maxAgentPercent, maxTotalPercent];
    if (!planName.trim() || values.some((value) => value.trim() === '' || !Number.isFinite(Number(value)))) {
      toast.error('Plan name and all three approved percentage limits are required.');
      return;
    }
    savePlanMutation.mutate({
      id: editingPlanId || undefined,
      name: planName.trim(),
      description: planDescription.trim() || undefined,
      agentPercent: Number(agentPercent),
      maxAgentPercent: Number(maxAgentPercent),
      maxTotalPercent: Number(maxTotalPercent),
      overrides,
    });
  }

  async function handleBulkApprove() {
    if (pendingCommissions.length === 0) {
      toast.info('No pending commissions to approve.');
      return;
    }
    const results = await Promise.allSettled(pendingCommissions.map((commission: any) => approveCommission(commission.id)));
    const succeeded = results.filter((result) => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    if (failed === 0) toast.success(`Approved ${succeeded} commission record(s).`);
    else toast.error(`${succeeded} commission(s) approved; ${failed} failed. Refresh and inspect failed rows.`);
  }

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Commission Engine &amp; Payout Control
            </h1>
            <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
              Actual accrued records are shown separately from global commission-plan rules. Accrual is blocked until a plan has approved agent and total caps; no default percentage is assumed.
            </p>
          </div>
          <button type="button" onClick={() => { void queryClient.invalidateQueries({ queryKey: ['finance-commissions'] }); void refetchPlans(); }} disabled={plansFetching} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50">
            <RefreshCw className={'h-3.5 w-3.5 ' + (plansFetching ? 'animate-spin' : '')} /> Refresh
          </button>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-xs">
          <button type="button" onClick={() => setActiveTab('LEDGER')} className={'rounded-md px-3 py-2 font-bold ' + (activeTab === 'LEDGER' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>Commission ledger</button>
          <button type="button" onClick={() => setActiveTab('PLANS')} className={'rounded-md px-3 py-2 font-bold ' + (activeTab === 'PLANS' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent')}>Commission plans ({plans.length})</button>
        </div>

        {activeTab === 'LEDGER' && (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{commissionRows.length} persisted commission row(s)</span>
              <span>{pendingCommissions.length} pending approval</span>
            </div>
            {!canManagePlans && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-muted-foreground">
                <Lock className="mr-1 inline h-3.5 w-3.5" /> Global plan configuration is read-only for this account; commission approvals remain governed by the server's role policy.
              </div>
            )}
            {isError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">Commission ledger failed to load.</p>
                <p className="mt-1 text-xs text-muted-foreground">Verify the database migrations that add tenant keys to Commission and Settlement have been applied. No fabricated values are displayed.</p>
              </div>
            ) : isLoading ? (
              <div className="rounded-xl border p-8 text-center text-xs text-muted-foreground">Loading persisted commission records…</div>
            ) : (
              <>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void handleBulkApprove()}
                    disabled={isApproving || pendingCommissions.length === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {isApproving ? 'Approving…' : 'Approve pending'}
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border bg-card text-xs">
                  <table className="w-full min-w-[1050px] text-left border-collapse">
                    <thead>
                      <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                        <th className="p-3">Policy No.</th>
                        <th className="p-3">Recipient</th>
                        <th className="p-3">Role Tier</th>
                        <th className="p-3">Gross Premium</th>
                        <th className="p-3">Commissionable Base</th>
                        <th className="p-3">Effective Rate</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Accrual Status</th>
                        <th className="p-3">Payout Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {commissionRows.length === 0 ? (
                        <tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No commission records have been accrued for this organization.</td></tr>
                      ) : commissionRows.map((commission: any) => (
                        <tr key={commission.id} className="hover:bg-accent/40">
                          <td className="p-3 font-mono font-bold text-primary">{commission.policyNumber || 'Policy unavailable'}</td>
                          <td className="p-3 font-semibold">{commission.agentName || 'Recipient unavailable'}</td>
                          <td className="p-3"><span className="rounded border bg-muted px-2 py-0.5 text-[10px] font-bold">{commission.roleTier}</span></td>
                          <td className="p-3 font-mono">{currency(commission.grossPremium)}</td>
                          <td className="p-3 font-mono">{currency(commission.commissionableBase)}</td>
                          <td className="p-3 font-bold text-primary">{commission.commissionPercent == null ? '—' : Number(commission.commissionPercent).toFixed(2) + '%'}</td>
                          <td className="p-3 font-extrabold text-emerald-600 font-mono">{currency(commission.commissionAmount)}</td>
                          <td className="p-3"><StatusBadge status={commission.status} /></td>
                          <td className="p-3">
                            <StatusBadge status={commission.payoutStatus} />
                            {commission.payoutStatus === 'REALIZED' && <div className="mt-1 text-[9px] text-muted-foreground">Realized; awaiting payout posting</div>}
                            {commission.payoutStatus === 'APPROVED' && <div className="mt-1 text-[9px] text-muted-foreground">Approved; awaiting policy payment / realization</div>}
                          </td>
                          <td className="p-3 text-right">
                            {commission.payoutStatus === 'PENDING_APPROVAL' ? (
                              <button type="button" onClick={() => void approveCommission(commission.id)} disabled={isApproving} className="rounded bg-emerald-600 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                            ) : <span className="text-[10px] text-muted-foreground">{commission.payoutStatus === 'PAID' ? 'Paid' : commission.payoutStatus === 'CANCELLED' ? 'Cancelled' : 'No action'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === 'PLANS' && (
          <section className="space-y-4">
            {!canReadPlans ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-xs">
                <Lock className="mr-1 inline h-4 w-4" /> This account does not have commission-plan read permission.
              </div>
            ) : plansError ? (
              <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
                <p className="font-semibold">Commission plans failed to load.</p>
                <button type="button" onClick={() => void refetchPlans()} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button>
              </div>
            ) : plansLoading ? (
              <div className="rounded-xl border p-8 text-center text-xs text-muted-foreground">Loading saved commission plans…</div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold">Approved rules and caps</h2>
                    <p className="mt-1 text-[11px] text-muted-foreground">The current schema stores plans globally; editing is restricted to a platform super-administrator.</p>
                  </div>
                  {canManagePlans && <button type="button" onClick={() => { resetPlanForm(); setShowPlanForm(true); }} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><PlusCircle className="h-3.5 w-3.5" /> Add plan</button>}
                </div>

                {showPlanForm && canManagePlans && (
                  <form onSubmit={handleSavePlan} className="rounded-xl border bg-card p-4 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-bold">{editingPlanId ? 'Edit commission plan' : 'Create commission plan'}</h3>
                        <p className="mt-1 text-[11px] text-muted-foreground">Rates apply to the linked policy quotation's premium excluding GST. These caps must match the signed commission agreement.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Plan name</label>
                        <input value={planName} onChange={(event) => setPlanName(event.target.value)} required maxLength={120} className="w-full rounded-lg border bg-background p-2.5 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Description</label>
                        <input value={planDescription} onChange={(event) => setPlanDescription(event.target.value)} maxLength={500} className="w-full rounded-lg border bg-background p-2.5 text-xs" placeholder="Agreement reference / effective terms" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Agent commission %</label>
                        <input type="number" min="0" max="100" step="0.01" value={agentPercent} onChange={(event) => setAgentPercent(event.target.value)} required className="w-full rounded-lg border bg-background p-2.5 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Maximum agent %</label>
                        <input type="number" min="0" max="100" step="0.01" value={maxAgentPercent} onChange={(event) => setMaxAgentPercent(event.target.value)} required className="w-full rounded-lg border bg-background p-2.5 text-xs" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Maximum total payout %</label>
                        <input type="number" min="0" max="100" step="0.01" value={maxTotalPercent} onChange={(event) => setMaxTotalPercent(event.target.value)} required className="w-full rounded-lg border bg-background p-2.5 text-xs" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Manager overrides JSON</label>
                        <textarea value={overridesJson} onChange={(event) => setOverridesJson(event.target.value)} rows={4} className="w-full rounded-lg border bg-background p-2.5 font-mono text-xs" />
                        <p className="text-[10px] text-muted-foreground">Use [] if there are no overrides. Each override needs roleTier, userId, and percent. At accrual time each recipient must be active and belong to the same organization as the policy.</p>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={resetPlanForm} className="rounded-lg border px-3 py-2 text-xs font-semibold">Cancel</button>
                      <button type="submit" disabled={savePlanMutation.isPending} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-50">
                        {savePlanMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {savePlanMutation.isPending ? 'Saving…' : editingPlanId ? 'Save changes' : 'Create plan'}
                      </button>
                    </div>
                  </form>
                )}

                {plans.length === 0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center">
                    <AlertTriangle className="mx-auto h-7 w-7 text-muted-foreground" />
                    <h3 className="mt-3 text-sm font-bold">No commission plans configured</h3>
                    <p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">Accrual is intentionally blocked until an approved plan, agent percentage, and plan caps are stored.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {plans.map((plan) => {
                      const rules = plan.rules && typeof plan.rules === 'object' ? plan.rules : {};
                      return (
                        <article key={plan.id} className="rounded-xl border bg-card p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-bold">{plan.name}</h3>
                                <span className={'rounded-full border px-2 py-0.5 text-[9px] font-bold ' + (plan.isActive ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700' : 'text-muted-foreground')}>{plan.isActive ? 'ACTIVE' : 'INACTIVE'}</span>
                                {plan.rulesStatus === 'INVALID' && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold text-destructive">INVALID RULE JSON</span>}
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">{plan.description || 'No agreement description stored.'}</p>
                            </div>
                            {canManagePlans && (
                              <div className="flex gap-1">
                                <button type="button" onClick={() => openEditPlan(plan)} className="rounded-lg border p-2 hover:bg-accent" aria-label={'Edit ' + plan.name}><Pencil className="h-3.5 w-3.5" /></button>
                                <button type="button" onClick={() => togglePlanMutation.mutate(plan.id)} disabled={togglePlanMutation.isPending} className="rounded-lg border p-2 hover:bg-accent disabled:opacity-50" aria-label={'Toggle ' + plan.name}><Power className="h-3.5 w-3.5" /></button>
                              </div>
                            )}
                          </div>
                          {plan.rulesStatus === 'INVALID' ? (
                            <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs">Stored rule JSON is invalid. Correct the rules before using this plan.</p>
                          ) : (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <RuleValue label="Agent rate" value={rules.agentPercent} />
                              <RuleValue label="Agent cap" value={rules.maxAgentPercent} />
                              <RuleValue label="Total cap" value={rules.maxTotalPercent} />
                              <RuleValue label="Manager overrides" value={Array.isArray(rules.overrides) ? rules.overrides.length : 0} />
                            </div>
                          )}
                          <div className="border-t pt-2 text-[10px] text-muted-foreground">
                            {plan.updatedAt ? 'Updated ' + new Date(plan.updatedAt).toLocaleString('en-IN') : 'Update timestamp unavailable'} · Accrual base: policy-linked quotation excluding GST.
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}

function RuleValue({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-lg border p-3"><div className="text-[10px] text-muted-foreground">{label}</div><div className="mt-1 text-sm font-black">{value === null || value === undefined || value === '' ? 'Not configured' : label === 'Manager overrides' ? String(value) : Number(value).toFixed(2) + '%'}</div></div>;
}
