'use client';

import React from 'react';
import { UnifiedChart } from '../../charts/unified-chart';
import { Filter } from 'lucide-react';

const FUNNEL_DATA = [
  { stage: 'New Leads', count: 420 },
  { stage: 'Contacted', count: 310 },
  { stage: 'Quoted', count: 195 },
  { stage: 'Converted', count: 142 },
];

export function LeadFunnelWidget() {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-indigo-500" />
          <h3 className="text-sm font-bold">Lead Conversion Pipeline</h3>
        </div>
        <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">
          33.8% Overall Conversion
        </span>
      </div>

      <UnifiedChart
        type="BAR"
        data={FUNNEL_DATA}
        dataKey="count"
        categoryKey="stage"
        height={280}
        colors={['#6366f1']}
      />
    </div>
  );
}
