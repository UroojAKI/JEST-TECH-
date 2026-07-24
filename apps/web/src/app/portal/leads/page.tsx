'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Plus, Filter, Phone, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAgentLeads } from '../../../hooks/usePortal';

const MOCK_LEADS = [
  { id: 'LEAD-8812', customerName: 'Vikas Sharma', mobile: '+91 98200 99881', productLine: 'Motor Comprehensive (Thar LX)', estimatedGwp: 16850, status: 'QUOTE_SENT', createdAt: '2026-07-24' },
  { id: 'LEAD-8813', customerName: 'Meena Iyer', mobile: '+91 98920 11223', productLine: 'Group Health Optima', estimatedGwp: 45000, status: 'NEGOTIATION', createdAt: '2026-07-23' },
  { id: 'LEAD-8814', customerName: 'Karan Malhotra', mobile: '+91 98190 33445', productLine: 'Two Wheeler Comprehensive', estimatedGwp: 2850, status: 'NEW', createdAt: '2026-07-24' },
];

export default function AgentLeadsPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredLeads = MOCK_LEADS.filter((l) => statusFilter === 'ALL' || l.status === statusFilter);

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agent Lead Pipeline</h1>
          <p className="text-xs text-muted-foreground">Track and nurture your prospective policy sales leads</p>
        </div>

        <button
          onClick={() => alert('Opening New Lead Form...')}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          <span>+ Create New Lead</span>
        </button>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {['ALL', 'NEW', 'QUOTE_SENT', 'NEGOTIATION', 'ISSUED'].map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
              statusFilter === st ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="space-y-3 text-xs">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="p-4 rounded-xl border bg-card shadow-sm flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-primary">{lead.id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border">{lead.status}</span>
              </div>
              <h4 className="font-extrabold text-sm text-foreground">{lead.customerName} ({lead.mobile})</h4>
              <p className="text-muted-foreground text-xs">{lead.productLine}</p>
            </div>

            <div className="text-right">
              <div className="font-mono font-black text-emerald-600 text-sm">Est. ₹{lead.estimatedGwp.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-muted-foreground">Created {lead.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
