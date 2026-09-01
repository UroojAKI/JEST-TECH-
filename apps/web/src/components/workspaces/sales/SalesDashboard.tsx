'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { SalesKPIs } from './SalesKPIs';
import { QuickActionsBar } from './QuickActionsBar';
import { AgentWorkQueue } from './AgentWorkQueue';
import { Customer360Drawer } from './Customer360Drawer';
import { PersistentStepTracker } from './PersistentStepTracker';
import { MotorProductCards } from './MotorProductCards';
import { MotorDashboardWidgets } from './MotorDashboardWidgets';
import { useSalesWorkspace } from '../../../hooks/useSalesWorkspace';
import { useAuthStore } from '../../../store/auth-store';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { customerRepository } from '../../../repositories/customer.repository';
import { Briefcase, Settings, RefreshCw, DollarSign, ShieldAlert, Search, Shield, Sparkles, MapPin, Calendar as CalendarIcon } from 'lucide-react';
import { toast } from 'sonner';

export function SalesDashboard() {
  const { kpis, isDashboardLoading, analytics } = useSalesWorkspace();
  const user = useAuthStore((s) => s.user);
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeStepIndex, setActiveStepIndex] = useState(4);
  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Agent' : 'Agent';
  const userBranch = (user as any)?.branch?.name || (user as any)?.branchName || '';
  const userRole = user?.roles?.[0] || (user as any)?.role || 'Executive';
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const { data: tasks } = useQuery({
    queryKey: ['agent-work-queue-tasks'],
    queryFn: async () => {
      try { const res = await apiClient.get('/workspace/sales/tasks'); return res.data; } catch { return null; }
    },
  });

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = globalSearch.trim();
    if (!query) return;
    try {
      const result = await customerRepository.getContacts({ page: 1, limit: 10, search: query });
      const matches = Array.isArray(result) ? result : result.data || [];
      if (!matches.length) {
        setSelectedContact(null);
        toast.info('No customer records matched your search.');
        return;
      }
      setSelectedContact(matches[0]);
      if (matches.length > 1) toast.info(`${matches.length} customer records matched. Showing the first result.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Customer search failed');
    }
  };

  if (isDashboardLoading) return <div className="p-12 text-center text-xs font-bold text-muted-foreground animate-pulse">Loading sales workspace...</div>;

  const workspaces = [
    { label: 'Sales Workspace', href: '/workspace/sales', icon: Briefcase, active: true },
    { label: 'Operations Workspace', href: '/workspace/operations', icon: Settings, active: false },
    { label: 'Renewal Workspace', href: '/workspace/renewal', icon: RefreshCw, active: false },
    { label: 'Finance Workspace', href: '/workspace/finance', icon: DollarSign, active: false },
    { label: 'Admin Workspace', href: '/workspace/admin', icon: ShieldAlert, active: false },
  ];

  return <div className="space-y-6 pb-12">
    <div className="flex border-b text-xs font-semibold overflow-x-auto space-x-2 pb-2">{workspaces.map((w) => { const Icon = w.icon; return <Link key={w.href} href={w.href} className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 whitespace-nowrap ${w.active ? 'bg-primary text-primary-foreground font-black shadow-xs' : 'bg-card border text-muted-foreground hover:text-foreground hover:bg-accent'}`}><Icon className="h-4 w-4" /><span>{w.label}</span></Link>; })}</div>
    <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border space-y-4"><div className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center space-x-2 text-[10px] font-black uppercase text-primary tracking-wider"><Sparkles className="h-3.5 w-3.5" /><span>JEST Policy CRM • Sales Workspace</span></div><h1 className="text-xl sm:text-2xl font-black tracking-tight mt-0.5">Welcome, {userName}</h1><div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1 font-semibold">{userBranch && <span className="flex items-center space-x-1"><MapPin className="h-3.5 w-3.5 text-primary" /><span>Branch: {userBranch}</span></span>}<span className="flex items-center space-x-1"><Shield className="h-3.5 w-3.5 text-emerald-600" /><span>{userRole.replace(/_/g, ' ')}</span></span><span className="flex items-center space-x-1"><CalendarIcon className="h-3.5 w-3.5 text-amber-600" /><span>Date: {todayStr}</span></span></div></div><form onSubmit={handleSearchSubmit} className="relative min-w-[280px] sm:min-w-[360px]"><input type="text" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search customer by name, phone or email..." className="w-full pl-9 pr-4 py-2.5 rounded-2xl border bg-card text-xs font-bold shadow-xs focus:ring-2 focus:ring-primary focus:outline-none" /><Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" /></form></div></div>
    <PersistentStepTracker currentStepIndex={activeStepIndex} onStepClick={setActiveStepIndex} />
    <SalesKPIs data={kpis} />
    <MotorProductCards />
    <QuickActionsBar onNewCustomerClick={() => { window.location.href = '/crm/contacts?create=1'; }} onFollowupsClick={() => setActiveFilter('FOLLOW_UP')} />
    <AgentWorkQueue tasks={tasks} activeFilter={activeFilter} onSelectFilter={setActiveFilter} />
    <MotorDashboardWidgets data={analytics} />
    <Customer360Drawer contact={selectedContact} isOpen={!!selectedContact} onClose={() => setSelectedContact(null)} />
  </div>;
}
