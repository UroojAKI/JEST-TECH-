'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import ProtectedRoute from '@/components/auth/protected-route';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import NotificationDrawer from '@/components/dashboard/notification-drawer';
import {
  LayoutDashboard,
  Shield,
  Users,
  Building2,
  Sparkles,
  FileText,
  ShieldCheck,
  AlertOctagon,
  BarChart3,
  Bell,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Search,
  Settings,
  Sliders,
  BookOpen,
  Database,
  PenTool,
  History,
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: countData } = useQuery({
    queryKey: ['notifications-count'],
    queryFn: async () => {
      const res = await api.get('/notifications/count');
      return res.data;
    },
    refetchInterval: 15000,
  });

  const unreadCount = countData?.count || 0;

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
    { label: 'Contacts', icon: Users, href: '#' },
    { label: 'Accounts', icon: Building2, href: '#' },
    { label: 'Leads', icon: Sparkles, href: '#' },
    { label: 'Quotations', icon: FileText, href: '#' },
    { label: 'Proposals', icon: FileText, href: '/dashboard/proposals' },
    { label: 'Policies', icon: ShieldCheck, href: '#' },
    { label: 'Endorsements', icon: Sliders, href: '/dashboard/endorsements' },
    { label: 'Claims', icon: AlertOctagon, href: '#' },
    { label: 'Analytics', icon: BarChart3, href: '#' },
    { label: 'Reports', icon: BookOpen, href: '/dashboard/reports' },
  ];

  const reportSubItems = [
    { label: 'Library', icon: Database, href: '/dashboard/reports' },
    { label: 'Builder', icon: PenTool, href: '/dashboard/reports/builder' },
    { label: 'KPI Manager', icon: BarChart3, href: '/dashboard/reports/kpi' },
    { label: 'History', icon: History, href: '/dashboard/reports/history' },
  ];

  if (user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN') {
    navItems.push({ label: 'Admin Settings', icon: Settings, href: '/dashboard/admin' });
  }

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100 font-sans">
        {/* Collapsible Sidebar */}
        <aside
          className={`glass border-r border-slate-900 transition-all duration-300 z-30 flex flex-col ${
            collapsed ? 'w-20' : 'w-64'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} fixed md:relative h-full`}
        >
          {/* Brand/Header */}
          <div className="flex h-16 items-center justify-between px-6 border-b border-slate-900">
            <Link href="/dashboard" className="flex items-center gap-2 font-bold text-white">
              <Shield className="h-6 w-6 text-indigo-500" />
              {!collapsed && <span>JEST CRM</span>}
            </Link>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="hidden md:flex rounded-lg p-1.5 hover:bg-slate-900 text-slate-400 hover:text-white"
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>

          {/* Nav Navigation */}
          <nav className="flex-1 space-y-1 px-4 py-4 overflow-y-auto">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={`flex items-center gap-4 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    active
                      ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                      : 'text-slate-400 hover:bg-slate-900/60 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User/Footer info */}
          <div className="p-4 border-t border-slate-900 bg-slate-950/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-300 font-bold">
                {user?.firstName?.[0] || 'U'}
                {user?.lastName?.[0] || 'U'}
              </div>
              {!collapsed && (
                <div className="flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                    {user?.role?.replace('_', ' ') || 'User'}
                  </p>
                </div>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-4 rounded-lg px-3 py-2.5 text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="glass h-16 border-b border-slate-900 px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setMobileOpen(!mobileOpen)}
                className="md:hidden rounded-lg p-2 hover:bg-slate-900 text-slate-400 hover:text-white"
              >
                <Menu className="h-6 w-6" />
              </button>
              <h2 className="text-lg font-bold text-white tracking-tight hidden sm:block">
                {user?.role ? `${user.role.replace('_', ' ')} Portal` : 'Dashboard'}
              </h2>

              {/* Search Bar */}
              <div className="relative w-full max-w-xs hidden md:block">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="search"
                  placeholder="Search policies, claims..."
                  className="w-full rounded-lg bg-slate-900/60 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 border border-slate-900 focus:border-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Header Right */}
            <div className="flex items-center gap-4">
              {/* Notification Bell UI */}
              <button
                onClick={() => setDrawerOpen(true)}
                className="relative rounded-lg p-2 hover:bg-slate-900 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[8px] font-black text-white ring-1 ring-slate-950">
                    {unreadCount}
                  </span>
                )}
              </button>

              <div className="h-6 w-px bg-slate-900" />

              {/* User Dropdown stub */}
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-white">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-slate-400">{user?.email}</p>
                </div>
                <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
                  {user?.firstName?.[0] || 'U'}
                </div>
              </div>
            </div>
          </header>

          {/* Main Dashboard Panel */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
            {children}
          </main>
        </div>
      </div>
      <NotificationDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </ProtectedRoute>
  );
}
