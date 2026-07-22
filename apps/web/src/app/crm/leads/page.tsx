'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Users, Plus, LayoutGrid, List, Flame, Clock, Filter, AlertTriangle } from 'lucide-react';
import { LeadItem, LeadStatus } from '../../../types/leads';

const LEADS_DATA: LeadItem[] = [
  {
    id: 'LD-00912',
    leadCode: 'LD-00912',
    firstName: 'Rahul',
    lastName: 'Patil',
    email: 'rahul.p@gmail.com',
    phone: '+91 98765 43210',
    status: 'QUOTE_PREPARED',
    source: 'WEBSITE',
    productInterest: 'Motor Comprehensive',
    priority: 'HOT',
    expectedPremium: 18450,
    probabilityScore: 84,
    assignedAgentName: 'Rajesh Sharma',
    tags: ['HOT', 'VIP', 'HIGH_PREMIUM'],
    slaStatus: 'ON_TRACK',
    slaTimeRemaining: '1h 45m',
    daysInPipeline: 4,
    duplicateWarning: true,
    createdAt: '2026-07-18',
  },
  {
    id: 'LD-00913',
    leadCode: 'LD-00913',
    firstName: 'Sunita',
    lastName: 'Kulkarni',
    email: 'sunita@yahoo.com',
    phone: '+91 91234 56789',
    status: 'CONTACTED',
    source: 'WHATSAPP',
    productInterest: 'Health Family Optima',
    priority: 'WARM',
    expectedPremium: 28000,
    probabilityScore: 65,
    assignedAgentName: 'Sunil Verma',
    tags: ['RENEWAL', 'CROSS_SELL'],
    slaStatus: 'WARNING',
    slaTimeRemaining: '30m',
    daysInPipeline: 2,
    createdAt: '2026-07-20',
  },
  {
    id: 'LD-00914',
    leadCode: 'LD-00914',
    firstName: 'Acme Logistics',
    lastName: '(Corp)',
    email: 'info@acme.com',
    phone: '+91 99887 76655',
    status: 'NEW',
    source: 'REFERRAL',
    productInterest: 'Group Health (50 Employees)',
    priority: 'HOT',
    expectedPremium: 450000,
    probabilityScore: 90,
    assignedAgentName: 'Rajesh Sharma',
    tags: ['CORPORATE', 'HIGH_PREMIUM'],
    slaStatus: 'ON_TRACK',
    slaTimeRemaining: '3h 10m',
    daysInPipeline: 1,
    createdAt: '2026-07-21',
  },
];

const STAGES: { status: LeadStatus; label: string }[] = [
  { status: 'NEW', label: 'NEW' },
  { status: 'CONTACTED', label: 'CONTACTED' },
  { status: 'DOCS_RECEIVED', label: 'DOCS RECEIVED' },
  { status: 'QUOTE_PREPARED', label: 'QUOTE PREPARED' },
  { status: 'NEGOTIATION', label: 'NEGOTIATION' },
  { status: 'PAYMENT_RECEIVED', label: 'PAYMENT RECEIVED' },
  { status: 'POLICY_ISSUED', label: 'POLICY ISSUED' },
];

export default function LeadsWorkspacePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('KANBAN');
  const [savedView, setSavedView] = useState<string>('MY_WORK');

  const filteredData = LEADS_DATA.filter((l) => {
    if (savedView === 'MY_WORK') return l.assignedAgentName === 'Rajesh Sharma';
    if (savedView === 'TODAY_FOLLOWUPS') return l.priority === 'HOT';
    if (savedView === 'LOST') return l.status === 'LOST';
    return true;
  });

  const columns = [
    {
      accessorKey: 'leadCode',
      header: 'Lead Code',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/crm/leads/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold text-primary"
        >
          {row.original.leadCode}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Prospect Name',
      cell: ({ row }: any) => `${row.original.firstName} ${row.original.lastName}`,
    },
    { accessorKey: 'productInterest', header: 'Product' },
    {
      accessorKey: 'expectedPremium',
      header: 'Expected Premium',
      cell: ({ row }: any) => `₹${row.original.expectedPremium.toLocaleString()}`,
    },
    {
      accessorKey: 'probabilityScore',
      header: 'Score',
      cell: ({ row }: any) => (
        <span className="font-bold text-primary">{row.original.probabilityScore} / 100</span>
      ),
    },
    { accessorKey: 'assignedAgentName', header: 'Assigned Agent' },
    {
      accessorKey: 'status',
      header: 'Stage',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Lead Management Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Enterprise sales acquisition pipeline & daily work queue</p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {/* View Toggle */}
          <div className="flex rounded-lg border bg-card p-0.5 text-xs">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md font-semibold transition-colors ${
                viewMode === 'KANBAN' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md font-semibold transition-colors ${
                viewMode === 'TABLE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table Register</span>
            </button>
          </div>

          <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
            <Plus className="h-4 w-4" />
            <span>+ Add Lead</span>
          </button>
        </div>
      </div>

      {/* "My Work" & Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'MY_WORK', label: "My Work Queue" },
          { id: 'TODAY_FOLLOWUPS', label: "Today's Follow-ups" },
          { id: 'OVERDUE', label: "Overdue" },
          { id: 'QUOTES_PENDING', label: "Quotes Pending" },
          { id: 'LOST', label: "Lost Leads" },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* View Rendering */}
      {viewMode === 'KANBAN' ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3 overflow-x-auto pb-4 pt-2">
          {STAGES.map((stage) => {
            const stageLeads = filteredData.filter((l) => l.status === stage.status);
            const totalGwp = stageLeads.reduce((acc, curr) => acc + curr.expectedPremium, 0);

            return (
              <div key={stage.status} className="rounded-xl border bg-muted/20 p-2.5 space-y-2 min-w-[240px]">
                <div className="flex justify-between items-center px-1">
                  <span className="font-bold text-[11px] uppercase tracking-wider">{stage.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-muted">
                    {stageLeads.length}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground px-1 font-semibold">
                  Expected: ₹{(totalGwp / 1000).toFixed(0)}k
                </div>

                <div className="space-y-2">
                  {stageLeads.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => router.push(`/crm/leads/${item.id}`)}
                      className="p-3 rounded-xl border bg-card hover:border-primary cursor-pointer transition-colors shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <span className="font-extrabold text-foreground">{item.firstName} {item.lastName}</span>
                        <span className="text-[10px] font-bold text-amber-500 flex items-center">
                          <Flame className="h-3 w-3 mr-0.5" />
                          {item.priority}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground">{item.productInterest}</div>

                      <div className="flex justify-between items-center pt-1 border-t text-[10px]">
                        <span className="font-bold text-emerald-600">₹{item.expectedPremium.toLocaleString()}</span>
                        <span className="text-primary font-bold">Score: {item.probabilityScore}</span>
                      </div>

                      <div className="text-[9px] text-muted-foreground flex justify-between items-center">
                        <span>Agent: {item.assignedAgentName}</span>
                        <span className="text-emerald-600 font-bold">{item.slaTimeRemaining}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EnterpriseTable data={filteredData} columns={columns} />
      )}
    </AppShell>
  );
}
