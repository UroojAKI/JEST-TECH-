'use client';

import React from 'react';

type CommissionComponent = 'OD' | 'TP';

interface CommissionBreakdownPanelProps {
  calculation?: any;
  components: CommissionComponent[];
  loading?: boolean;
  error?: string | null;
}

function money(value: unknown): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Commission must come from an approved insurer × product × component configuration.
 * This UI intentionally does not infer a percentage or commissionable base.
 */
export function CommissionBreakdownPanel({
  calculation,
  components,
  loading = false,
  error,
}: CommissionBreakdownPanelProps) {
  const result = calculation?.outputs?.commissionBreakdown
    ?? calculation?.commissionBreakdown
    ?? calculation?.rateConfig?.commissionBreakdown;
  const total = result?.totalCommissionAmount ?? result?.totalAmount;

  const rows = components.map((component) => {
    const lower = component.toLowerCase();
    const nested = result?.[lower] || {};
    return {
      component,
      rate: nested.ratePercent ?? result?.[lower + 'CommissionPercent'] ?? result?.[lower + 'RatePercent'],
      base: nested.commissionableBase ?? nested.base ?? result?.['commissionable' + component + 'Base'],
      amount: nested.amount ?? nested.commissionAmount ?? result?.[lower + 'CommissionAmount'],
    };
  });

  const configured = result?.status === 'CALCULATED'
    || rows.some((row) => row.rate !== undefined && row.amount !== undefined
      && Number.isFinite(Number(row.rate)) && Number.isFinite(Number(row.amount)));

  return (
    <section className="rounded-xl border border-border bg-card p-4 space-y-3" aria-label="Commission calculation">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-black text-foreground">Commission Calculation</h3>
          <p className="text-[10px] text-muted-foreground mt-1">
            Broker/agent commission is separate from the customer’s payable premium.
          </p>
        </div>
        <span className={"rounded-full px-2 py-1 text-[9px] font-bold " + (configured ? 'bg-emerald-500/10 text-emerald-700' : 'bg-amber-500/10 text-amber-700')}>
          {configured ? 'CONFIGURED' : 'CONFIGURATION PENDING'}
        </span>
      </div>

      {configured ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {rows.map((row) => (
              <div key={row.component} className="rounded-lg border border-border p-3">
                <div className="text-[10px] text-muted-foreground">{row.component} commission</div>
                <div className="mt-1 text-sm font-bold text-foreground">₹{money(row.amount)}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Rate: {row.rate === undefined ? '—' : String(row.rate) + '%'} · Commissionable base: ₹{money(row.base)}
                </div>
              </div>
            ))}
          </div>
          {total !== undefined && (
            <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
              <span className="text-xs font-bold">Total commission</span>
              <span className="text-sm font-black">₹{money(total)}</span>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs">
          <p className="font-semibold text-foreground">
            {loading ? 'Waiting for the authoritative calculation…' : 'No approved commission result was returned.'}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Configure and approve the insurer-, product-, policy-type- and component-specific commission agreement before a rate or amount can be shown. No default percentage or commissionable base is assumed.
          </p>
          {error && <p className="mt-2 text-[11px] text-destructive">Premium calculation error: {error}</p>}
        </div>
      )}
    </section>
  );
}
