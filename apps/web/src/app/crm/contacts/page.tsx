'use client';

import React, { useState } from 'react';
import useRouter from 'next/navigation';
import { useRouter as useNav } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Users, Plus, Building2, User } from 'lucide-react';

const CUSTOMERS_DATA = [
  { id: 'CUST-001928', name: 'Acme Logistics Pvt Ltd', type: 'CORPORATE', phone: '+91 98765 43210', email: 'contact@acme.com', branch: 'Mumbai HQ', tag: 'VIP', status: 'ACTIVE' },
  { id: 'CUST-001929', name: 'Rahul Sharma', type: 'INDIVIDUAL', phone: '+91 91234 56789', email: 'rahul.s@gmail.com', branch: 'Delhi Branch', tag: 'HIGH PREMIUM', status: 'ACTIVE' },
  { id: 'CUST-001930', name: 'TechCorp Solutions', type: 'CORPORATE', phone: '+91 99887 76655', email: 'info@techcorp.in', branch: 'Bangalore Branch', tag: 'RENEWAL PRIORITY', status: 'LAPSED' },
];

export default function CustomerRegisterPage() {
  const router = useNav();
  const [savedView, setSavedView] = useState<string>('ALL');

  const filteredData = CUSTOMERS_DATA.filter((c) => {
    if (savedView === 'CORPORATE') return c.type === 'CORPORATE';
    if (savedView === 'VIP') return c.tag === 'VIP';
    if (savedView === 'RENEWALS') return c.status === 'LAPSED';
    return true;
  });

  const columns = [
    {
      accessorKey: 'name',
      header: 'Customer Name',
      cell: ({ row }: any) => (
        <div
          onClick={() => router.push(`/crm/contacts/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold flex items-center space-x-2"
        >
          {row.original.type === 'CORPORATE' ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
          <span>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'id', header: 'Customer ID' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'branch', header: 'Branch' },
    {
      accessorKey: 'tag',
      header: 'Tags',
      cell: ({ row }: any) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
          {row.original.tag}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Customer Directory & Register
          </h1>
          <p className="text-xs text-muted-foreground">Manage individual and corporate customer portfolios</p>
        </div>
        <button className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow">
          <Plus className="h-4 w-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Saved Views Toolbar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Customers' },
          { id: 'VIP', label: 'VIP Accounts' },
          { id: 'CORPORATE', label: 'Corporate Clients' },
          { id: 'RENEWALS', label: 'Renewals Due' },
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
