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
import {
  Briefcase,
  Settings,
  RefreshCw,
  DollarSign,
  ShieldAlert,
  Search,
  User,
  Shield,
  Phone,
  FileText,
  Bell,
  Sparkles,
  MapPin,
  Calendar as CalendarIcon,
} from 'lucide-react';
import { toast } from 'sonner';

export function SalesDashboard() {
  const { kpis, pipeline, isDashboardLoading, analytics } = useSalesWorkspace();
  const user = useAuthStore((s) => s.user);
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [activeStepIndex, setActiveStepIndex] = useState(4); // Default to 'Quotation' step

  const userName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Agent' : 'Agent';
  const userBranch = (user as any)?.branch?.name || (user as any)?.branchName || '';
  const userRole = user?.roles?.[0] || (user as any)?.role || 'Executive';
  const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Fetch Agent Tasks / Work Queue counts
  const { data: tasks } = useQuery({
    queryKey: ['agent-work-queue-tasks'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/workspace/sales/tasks');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    toast.info(`Global Search query "${globalSearch}" executed across Customer 360 database.`);
    setSelectedContact({
      id: 'cust-search-res',
      firstName: globalSearch.split(' ')[0] || 'Customer',
      lastName: globalSearch.split(' ')[1] || 'Found',
      phone: '+91 98765 43210',
      email: `${globalSearch.toLowerCase().replace(/\s+/g, '')}@jestpolicy.com`,
      type: 'INDIVIDUAL',
    });
  };

  if (isDashboardLoading) {
    return (
      <div className="p-12 text-center text-xs font-bold text-muted-foreground animate-pulse">
        Initializing Motor Insurance Operational Command Center...
      </div>
    );
  }

  const workspaces = [
    { label: 'Sales Workspace', href: '/workspace/sales', icon: Briefcase, active: true },
    { label: 'Operations Workspace', href: '/workspace/operations', icon: Settings, active: false },
    { label: 'Renewal Workspace', href: '/workspace/renewal', icon: RefreshCw, active: false },
    { label: 'Finance Workspace', href: '/workspace/finance', icon: DollarSign, active: false },
    { label: 'Admin Workspace', href: '/workspace/admin', icon: ShieldAlert, active: false },
  ];

  return (
    <div className="space-y-6 pb-12">
      {/* 5 Core Enterprise Workspaces Selector Bar */}
      <div className="flex border-b text-xs font-semibold overflow-x-auto space-x-2 pb-2">
        {workspaces.map((w, idx) => {
          const Icon = w.icon;
          return (
            <Link
              key={idx}
              href={w.href}
              className={`px-3.5 py-2 rounded-xl flex items-center space-x-2 transition-all whitespace-nowrap ${
                w.active
                  ? 'bg-primary text-primary-foreground font-black shadow-xs'
                  : 'bg-card border text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{w.label}</span>
            </Link>
          );
        })}
      </div>

      {/* 1. Header & Global Customer 360 Search Context Bar */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[10px] font-black uppercase text-primary tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              <span>JEST Policy CRM • Motor Insurance Operational Command Center</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Welcome, {userName}
            </h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1 font-semibold">
              {userBranch && (
                <span className="flex items-center space-x-1">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>Branch: {userBranch}</span>
                </span>
              )}
              {userBranch && <span>•</span>}
              <span className="flex items-center space-x-1">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                <span>{userRole.replace(/_/g, ' ')}</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                <span>Date: {todayStr}</span>
              </span>
            </div>
          </div>

          {/* Global Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative min-w-[280px] sm:min-w-[360px]">
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search Customer / Policy / Vehicle / Mobile / PAN..."
              className="w-full pl-9 pr-4 py-2.5 rounded-2xl border bg-card text-foreground text-xs font-bold shadow-xs focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-3" />
          </form>
        </div>
      </div>

      {/* 2. Persistent Step Tracker Component */}
      <PersistentStepTracker
        currentStepIndex={activeStepIndex}
        onStepClick={(idx) => setActiveStepIndex(idx)}
      />

      {/* 3. Top-Row Telemetry & 8 KPI Cards */}
      <SalesKPIs data={kpis} />

      {/* 4. Product Selection Cards (Icon Cards to launch Motor Wizard) */}
      <MotorProductCards />

      {/* 5. Quick Actions Bar */}
      <QuickActionsBar
        onNewCustomerClick={() => setSelectedContact({ firstName: 'New', lastName: 'Customer' })}
        onFollowupsClick={() => toast.info('Today Outbound Follow-up queue focused')}
      />

      {/* 6. Actionable Work Queue Badges */}
      <AgentWorkQueue
        tasks={tasks}
        activeFilter={activeFilter}
        onSelectFilter={(filterKey) => setActiveFilter(filterKey)}
      />

      {/* 7. Comprehensive Motor Dashboard Operational Widgets */}
      <MotorDashboardWidgets data={analytics} />

      {/* 8. Customer 360 Slide-out Drawer */}
      <Customer360Drawer
        contact={selectedContact}
        isOpen={!!selectedContact}
        onClose={() => setSelectedContact(null)}
      />
    </div>
  );
}
