'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Building2, Plus, Users, ShieldCheck, DollarSign, Download } from 'lucide-react';
import { toast } from 'sonner';

const ACCOUNTS_DATA = [
  { id: 'ACC-00101', name: 'Acme Logistics Pvt Ltd', industry: 'Logistics & Supply Chain', contactsCount: 14, activePolicies: 3, totalAnnualPremium: '₹14,50,000', relationshipManager: 'Rajesh Sharma', status: 'ACTIVE' },
  { id: 'ACC-00102', name: 'TechCorp Solutions Ltd', industry: 'Information Technology', contactsCount: 28, activePolicies: 5, totalAnnualPremium: '₹32,00,000', relationshipManager: 'Sunil Verma', status: 'ACTIVE' },
  { id: 'ACC-00103', name: 'Global Manufacturing Corp', industry: 'Industrial Manufacturing', contactsCount: 42, activePolicies: 8, totalAnnualPremium: '₹85,00,000', relationshipManager: 'Priya Mehta', status: 'ACTIVE' },
  { id: 'ACC-00104', name: 'Apex Healthcare Services', industry: 'Healthcare & Pharma', contactsCount: 19, activePolicies: 2, totalAnnualPremium: '₹18,20,000', relationshipManager: 'Rajesh Sharma', status: 'LAPSED' },
];

export default function CorporateAccountsPage() {
  const router = useRouter();
  const [savedView, setSavedView] = useState<string>('ALL');

  const filteredData = ACCOUNTS_DATA.filter((acc) => {
    if (savedView === 'ACTIVE') return acc.status === 'ACTIVE';
    if (savedView === 'LAPSED') return acc.status === 'LAPSED';
    return true;
  });

  const columns = [
    {
      accessorKey: 'name',
      header: 'Account Name',
      cell: ({ row }: any) => (
        <div className="font-bold flex items-center space-x-2 text-primary hover:underline cursor-pointer">
          <Building2 className="h-4 w-4" />
          <span>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'id', header: 'Account ID' },
    { accessorKey: 'industry', header: 'Industry' },
    { accessorKey: 'contactsCount', header: 'Key Contacts' },
    { accessorKey: 'activePolicies', header: 'Policies' },
    {
      accessorKey: 'totalAnnualPremium',
      header: 'Annual Premium',
      cell: ({ row }: any) => <span className="font-extrabold text-emerald-600">{row.original.totalAnnualPremium}</span>,
    },
    { accessorKey: 'relationshipManager', header: 'RM' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Corporate Accounts Register
          </h1>
          <p className="text-xs text-muted-foreground">Manage enterprise B2B accounts, group policies, and relationship managers</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => toast.info('Exporting Corporate Accounts CSV...')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md border bg-card hover:bg-accent"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button
            onClick={() => toast.success('New Corporate Account wizard opened')}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Corporate Premium</span>
          <div className="font-extrabold text-emerald-600 text-sm">₹1.49 Cr</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Active Enterprise Clients</span>
          <div className="font-extrabold text-foreground text-sm">34 Accounts</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Avg Policies per Account</span>
          <div className="font-extrabold text-primary text-sm">4.2 Policies</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Group Health Lives Covered</span>
          <div className="font-extrabold text-indigo-600 text-sm">12,450 Lives</div>
        </div>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Accounts' },
          { id: 'ACTIVE', label: 'Active B2B Clients' },
          { id: 'LAPSED', label: 'Lapsed / Renewal Due' },
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

      <EnterpriseTable data={filteredData} columns={columns} />
    </AppShell>
  );
}
