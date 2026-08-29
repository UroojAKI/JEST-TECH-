'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Users, Search, Phone, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

interface ContactItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city?: string;
  policies?: any[];
  createdAt: string;
}

export default function AgentCustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: contacts = [], isLoading } = useQuery<ContactItem[]>({
    queryKey: ['agent-customers'],
    queryFn: async () => {
      const res = await apiClient.get('/contacts');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const filteredCustomers = contacts.filter((c) => {
    const fullName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const query = searchQuery.toLowerCase();
    return (
      fullName.includes(query) ||
      (c.phone && c.phone.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(query)) ||
      c.id.toLowerCase().includes(query)
    );
  });

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
          placeholder="Search by customer name, mobile, email, ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 rounded-xl border bg-card text-xs focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground">Loading customers...</div>
      ) : filteredCustomers.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">No customers found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {filteredCustomers.map((cust) => (
            <div key={cust.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
              <div className="flex justify-between items-start border-b pb-2">
                <div>
                  <span className="font-mono font-bold text-[10px] text-primary">{cust.id.slice(0, 8)}</span>
                  <h3 className="font-extrabold text-sm text-foreground">{cust.firstName} {cust.lastName}</h3>
                  <span className="text-[10px] text-muted-foreground">{cust.city || 'Standard'}</span>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-bold text-[10px]">
                  {cust.policies?.length || 0} Policies
                </span>
              </div>

              <div className="space-y-1 text-muted-foreground">
                <div className="flex items-center space-x-1"><Phone className="h-3 w-3" /> <span>{cust.phone || 'N/A'}</span></div>
                <div className="flex items-center space-x-1"><Mail className="h-3 w-3" /> <span>{cust.email || 'N/A'}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
