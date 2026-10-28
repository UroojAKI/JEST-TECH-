'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { HeartPulse } from 'lucide-react';
import { healthQuotationRepository } from '../../repositories/health-quotation.repository';
import { PLAN_CATEGORIES, inr, labelOf } from './healthFormConfig';

/** Health proposals linked to a lead, shown on the lead's Quotation Engine tab. */
export function HealthLeadCases({ leadId }: { leadId: string }) {
  const { data: cases = [] } = useQuery({
    queryKey: ['health-lead-cases', leadId],
    queryFn: () => healthQuotationRepository.getCasesForLead(leadId),
  });

  if (!cases.length) return null;

  return (
    <div className="p-4 rounded-xl border bg-card space-y-2">
      <h3 className="text-sm font-black text-foreground flex items-center gap-2">
        <HeartPulse className="h-4 w-4 text-primary" /> Health Proposals ({cases.length})
      </h3>
      {cases.map((c: any) => {
        const selected = c.quotations?.find((q: any) => q.id === c.selectedQuoteId);
        return (
          <Link
            key={c.id}
            href={`/sales/health-quotations/${c.id}`}
            className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border hover:bg-accent text-xs"
          >
            <span className="font-bold">
              {c.caseCode} • {labelOf(PLAN_CATEGORIES, c.planCategory)}
            </span>
            <span className="text-muted-foreground">
              {c.quotations?.length ?? 0} quote(s){selected ? ` • Selected ${selected.insurerName} ${inr(selected.totalPremium)}` : ''}
            </span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-black text-[10px]">{c.status}</span>
          </Link>
        );
      })}
    </div>
  );
}
