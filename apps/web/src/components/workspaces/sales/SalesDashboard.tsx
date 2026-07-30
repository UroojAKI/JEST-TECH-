'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SalesKPIs } from './SalesKPIs';
import { QuickActionsBar } from './QuickActionsBar';
import { AgentWorkQueue } from './AgentWorkQueue';
import { Customer360Drawer } from './Customer360Drawer';
import { useSalesWorkspace } from '../../../hooks/useSalesWorkspace';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import {
  Users,
  PhoneCall,
  PlusCircle,
  Calculator,
  ArrowRight,
  User,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

export function SalesDashboard() {
  const { kpis, pipeline, isDashboardLoading } = useSalesWorkspace();
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);

  // Fetch Agent Tasks / Work Queue counts
  const { data: tasks } = useQuery({
    queryKey: ['agent-work-queue-tasks'],
    queryFn: async () => {
      const res = await apiClient.get('/workspace/sales/tasks');
      return res.data;
    },
  });

  if (isDashboardLoading) {
    return (
      <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">
        Loading Agent Primary Workspace...
      </div>
    );
  }

  const leadsList = pipeline?.leads || [];
  const filteredLeads = activeFilter
    ? leadsList.filter((l: any) => (l.currentWorkflowStep || 'ASSIGNED') === activeFilter)
    : leadsList;

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-primary">
            Agent Primary Workspace • Role-Centric Daily Operations
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
            Agent Operational Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
            Complete your daily insurance operations—from lead follow-ups, motor quote calculations, underwriting proposals, payment collection, to policy issuance—from a single workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/sales/quotations"
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>New Motor Quote</span>
          </Link>
        </div>
      </div>

      {/* 2. Top-Row Telemetry & KPI Cards */}
      <SalesKPIs data={kpis} />

      {/* 3. Quick Actions Bar */}
      <QuickActionsBar
        onNewCustomerClick={() => toast.info('Customer Creation form opened in drawer')}
        onFollowupsClick={() => toast.info('Today\'s Outbound Calls Queue focused')}
      />

      {/* 4. Actionable Work Queue Badges */}
      <AgentWorkQueue
        tasks={tasks}
        activeFilter={activeFilter}
        onSelectFilter={(filterKey) => setActiveFilter(filterKey)}
      />

      {/* 5. Assigned Work Cases & Appointments Table */}
      <div className="p-5 rounded-2xl border bg-card space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
              {activeFilter ? `Filtered Work Queue: ${activeFilter}` : 'Active Agent Pipeline Cases'}
            </span>
            <h3 className="text-sm font-extrabold text-foreground">
              Today's Cases & Appointments
            </h3>
          </div>
          <Link
            href="/crm/leads"
            className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
          >
            <span>View Complete CRM Pipeline</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                <th className="py-2.5 px-3">Lead Code</th>
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Product Interest</th>
                <th className="py-2.5 px-3">Workflow Stage</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-semibold">
              {filteredLeads.slice(0, 10).map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-primary font-bold">{l.leadCode}</td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => setSelectedContact(l.contact || { firstName: 'Customer', lastName: 'Name' })}
                      className="font-bold text-foreground hover:text-primary text-left"
                    >
                      {l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : l.title}
                    </button>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{l.title}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      {l.currentWorkflowStep || 'ASSIGNED'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-muted/30 text-muted-foreground">
                      {l.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/workspace/sales/leads/${l.id}`}
                      className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all shadow-xs"
                    >
                      Open Case
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. Customer 360 Slide-out Drawer */}
      <Customer360Drawer
        contact={selectedContact}
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
}
