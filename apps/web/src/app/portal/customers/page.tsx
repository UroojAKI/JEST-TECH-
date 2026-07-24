'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Users, Search, Phone, Mail, MessageSquare, ArrowRight } from 'lucide-react';

const MOCK_AGENT_CUSTOMERS = [
  { id: 'CUST-00104', name: 'Rahul Patil', mobile: '+91 98201 12345', email: 'rahul.patil@gmail.com', city: 'Mumbai', activePoliciesCount: 2, totalGwp: 48500, lastInteraction: 'Today 10:15 AM' },
  { id: 'CUST-00105', name: 'Acme Logistics Pvt Ltd', mobile: '+91 98920 88123', email: 'fleet@acmelogistics.com', city: 'Pune', activePoliciesCount: 5, totalGwp: 384000, lastInteraction: 'Yesterday' },
  { id: 'CUST-00106', name: 'Sunita Kulkarni', mobile: '+91 98920 54321', email: 'sunita.k@yahoo.com', city: 'Mumbai', activePoliciesCount: 1, totalGwp: 18500, lastInteraction: '2 days ago' },
];

export default function AgentCustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCustomers = MOCK_AGENT_CUSTOMERS.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.mobile.includes(searchQuery) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AppShell>
      <div className="flex justify-between items-center border-b pb-3 text-xs">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> My Customer Directory
          </h1>
          <p className="text-xs text-muted-foreground">Manage your assigned customer accounts, active policies, and contact history</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by customer name, mobile, policy no..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        {filteredCustomers.map((cust) => (
          <div key={cust.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <span className="font-mono font-bold text-[10px] text-primary">{cust.id}</span>
                <h3 className="font-extrabold text-sm text-foreground">{cust.name}</h3>
                <span className="text-[10px] text-muted-foreground">{cust.city}</span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                {cust.activePoliciesCount} Active Policies
              </span>
            </div>

            <div className="space-y-1 text-muted-foreground">
              <div className="flex items-center space-x-1"><Phone className="h-3 w-3" /> <span>{cust.mobile}</span></div>
              <div className="flex items-center space-x-1"><Mail className="h-3 w-3" /> <span>{cust.email}</span></div>
            </div>

            <div className="p-2.5 rounded-lg border bg-muted/10 flex justify-between items-center font-bold">
              <span>Lifetime Premium:</span>
              <span className="font-mono text-emerald-600 text-sm">₹{cust.totalGwp.toLocaleString('en-IN')}</span>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
