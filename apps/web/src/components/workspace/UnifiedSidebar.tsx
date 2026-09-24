'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../../store/auth-store';
import {
  LayoutDashboard, Users, FileText, Shield, RefreshCw,
  AlertTriangle, BarChart3, Settings, ChevronLeft, ChevronRight,
  Target, ClipboardList, Car, UserCheck, TrendingUp, DollarSign,
  Briefcase, Building2, ShieldCheck, Bell, LogOut
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  permission?: string;
}

function getWorkspaceNav(pathname: string, role: string): { title: string; items: NavItem[] } {
  const roleUpper = (role || '').toUpperCase();

  // Sales workspace
  if (pathname.startsWith('/workspace/sales') || pathname.startsWith('/workspace/sales-manager')) {
    return {
      title: 'Sales & Distribution',
      items: [
        { label: 'Dashboard', href: '/workspace/sales', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Contacts', href: '/crm/contacts', icon: <UserCheck className="h-4 w-4" /> },
        { label: 'Leads', href: '/crm/leads', icon: <Target className="h-4 w-4" /> },
        { label: 'Quotations', href: '/workspace/sales?tab=quotes', icon: <FileText className="h-4 w-4" /> },
        { label: 'Policies', href: '/policies', icon: <Shield className="h-4 w-4" /> },
        { label: 'Renewals', href: '/renewals', icon: <RefreshCw className="h-4 w-4" /> },
        { label: 'Notifications', href: '/portal/renewals', icon: <Bell className="h-4 w-4" /> },
      ],
    };
  }

  // Renewal workspace
  if (pathname.startsWith('/workspace/renewal')) {
    return {
      title: 'Renewals & Retention',
      items: [
        { label: 'Dashboard', href: '/workspace/renewal', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Upcoming Renewals', href: '/renewals', icon: <RefreshCw className="h-4 w-4" /> },
        { label: 'Overdue', href: '/renewals?status=overdue', icon: <AlertTriangle className="h-4 w-4" /> },
        { label: 'Contacts', href: '/crm/contacts', icon: <UserCheck className="h-4 w-4" /> },
        { label: 'Policies', href: '/policies', icon: <Shield className="h-4 w-4" /> },
      ],
    };
  }

  // Operations/Back Office workspace
  if (pathname.startsWith('/workspace/operations')) {
    return {
      title: 'Back Office Operations',
      items: [
        { label: 'Dashboard', href: '/workspace/operations', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Operations Queue', href: '/workspace/operations?tab=issuance', icon: <ClipboardList className="h-4 w-4" /> },
        { label: 'Inspections', href: '/workspace/operations?tab=inspections', icon: <Car className="h-4 w-4" /> },
        { label: 'Policy Issuance', href: '/workspace/operations?tab=issuance', icon: <Shield className="h-4 w-4" /> },
        { label: 'Documents', href: '/documents', icon: <FileText className="h-4 w-4" /> },
        { label: 'Renewals', href: '/workspace/renewal', icon: <RefreshCw className="h-4 w-4" /> },
        { label: 'Claims', href: '/claims', icon: <AlertTriangle className="h-4 w-4" /> },
      ],
    };
  }

  // Finance workspace
  if (pathname.startsWith('/workspace/finance')) {
    return {
      title: 'Finance',
      items: [
        { label: 'Dashboard', href: '/workspace/finance', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Payments', href: '/finance/payments', icon: <DollarSign className="h-4 w-4" /> },
        { label: 'Ledger', href: '/finance/ledger', icon: <BarChart3 className="h-4 w-4" /> },
        { label: 'Commissions', href: '/finance/commissions', icon: <TrendingUp className="h-4 w-4" /> },
        { label: 'Settlements', href: '/finance/settlements', icon: <Briefcase className="h-4 w-4" /> },
        { label: 'Receipts', href: '/finance/receipts', icon: <FileText className="h-4 w-4" /> },
      ],
    };
  }

  // Admin workspace
  if (pathname.startsWith('/workspace/admin')) {
    return {
      title: 'Administration',
      items: [
        { label: 'Dashboard', href: '/workspace/admin', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Users', href: '/admin/users', icon: <Users className="h-4 w-4" /> },
        { label: 'Roles & Permissions', href: '/admin/roles', icon: <ShieldCheck className="h-4 w-4" /> },
        { label: 'Branches', href: '/admin/branches', icon: <Building2 className="h-4 w-4" /> },
        { label: 'System Config', href: '/admin/config', icon: <Settings className="h-4 w-4" /> },
        { label: 'Audit Logs', href: '/admin/audit', icon: <ClipboardList className="h-4 w-4" /> },
        { label: 'SLA Policies', href: '/admin/sla', icon: <Shield className="h-4 w-4" /> },
      ],
    };
  }

  // Executive workspace
  if (pathname.startsWith('/workspace/executive')) {
    return {
      title: 'Executive Dashboard',
      items: [
        { label: 'Dashboard', href: '/workspace/executive', icon: <LayoutDashboard className="h-4 w-4" /> },
        { label: 'Performance', href: '/portal/performance', icon: <BarChart3 className="h-4 w-4" /> },
        { label: 'Reports', href: '/portal/branch-manager', icon: <FileText className="h-4 w-4" /> },
      ],
    };
  }

  // Default fallback
  return {
    title: 'Workspace',
    items: [
      { label: 'Home', href: '/workspace', icon: <LayoutDashboard className="h-4 w-4" /> },
    ],
  };
}

export function UnifiedSidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const role = user?.roles?.[0] || (user as any)?.role || 'AGENT';

  const { title, items } = getWorkspaceNav(pathname, role);

  return (
    <aside
      className={`flex flex-col border-r bg-card transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-64'
      } shrink-0 overflow-hidden`}
    >
      {/* Sidebar header with workspace title */}
      <div className="flex items-center justify-between px-4 py-4 border-b">
        {!collapsed && (
          <div className="min-w-0">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Workspace</div>
            <div className="text-xs font-black text-foreground truncate">{title}</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ml-auto"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-primary/10 text-primary font-bold border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Switch workspace link at bottom */}
      {!collapsed && (
        <div className="p-3 border-t">
          <Link
            href="/workspace"
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all w-full"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <span>Switch Workspace</span>
          </Link>
        </div>
      )}
    </aside>
  );
}
