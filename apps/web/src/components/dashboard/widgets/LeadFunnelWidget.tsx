'use client';

import React from 'react';
import { UnifiedChart } from '../../charts/unified-chart';
import { Filter } from 'lucide-react';
import { useLeads } from '../../../hooks/useLeads';

export function LeadFunnelWidget() {
  const { leads, isLoading } = useLeads();
  const leadsList = Array.isArray(leads) ? leads : [];

  const newCount = leadsList.filter((l: any) => l.status === 'NEW').length;
  const contactedCount = leadsList.filter((l: any) => l.status === 'CONTACTED' || l.status === 'DOCS_RECEIVED').length;
  const quotedCount = leadsList.filter((l: any) => l.status === 'QUOTE_PREPARED' || l.status === 'NEGOTIATION').length;
  const convertedCount = leadsList.filter((l: any) => l.status === 'POLICY_ISSUED' || l.status === 'PAYMENT_RECEIVED' || l.status === 'CONVERTED').length;

  const funnelData = [
    { stage: 'New Leads', count: newCount },
    { stage: 'Contacted', count: contactedCount },
    { stage: 'Quoted', count: quotedCount },
    { stage: 'Converted', count: convertedCount },
  ];

  const totalLeads = leadsList.length;
  const conversionPct = totalLeads > 0 ? ((convertedCount / totalLeads) * 100).toFixed(1) : '0.0';


  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-bold">Lead Conversion Pipeline</h3>
        </div>
        <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          {isLoading ? 'Loading...' : `${conversionPct}% Live Conversion`}
        </span>
      </div>

      <UnifiedChart
        type="BAR"
        data={funnelData}
        dataKey="count"
        categoryKey="stage"
        height={280}
        colors={['#6366f1']}
      />
    </div>
  );
}
