'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  ShieldCheck,
  FileText,
  Wallet,
  BarChart3,
  Settings,
  Sliders,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { navigationRegistry } from '../../lib/navigation/navigation.registry';
import { usePermissions } from '../providers/permission-provider';
import { useUIStore } from '../../store/ui-store';
import { NavigationItem } from '../../types';

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutDashboard: <LayoutDashboard className="h-4 w-4" />,
  Users: <Users className="h-4 w-4" />,
  FileSpreadsheet: <FileSpreadsheet className="h-4 w-4" />,
  ShieldCheck: <ShieldCheck className="h-4 w-4" />,
  FileText: <FileText className="h-4 w-4" />,
  Wallet: <Wallet className="h-4 w-4" />,
  BarChart3: <BarChart3 className="h-4 w-4" />,
  Settings: <Settings className="h-4 w-4" />,
  Sliders: <Sliders className="h-4 w-4" />,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { canAccess } = usePermissions();
  const isSidebarOpen = useUIStore((s) => s.isSidebarOpen);
  const [openChildren, setOpenChildren] = useState<Record<string, boolean>>({
    crm: true,
    sales: true,
    finance: true,
  });

  const toggleSubmenu = (id: string) => {
    setOpenChildren((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredNav = navigationRegistry.filter((item) =>
    canAccess({
      roles: item.roles,
      permissions: item.permissions,
      featureFlag: item.featureFlag,
    })
  );

  if (!isSidebarOpen) return null;

  return (
    <aside className="w-64 border-r bg-card/50 backdrop-blur flex flex-col justify-between h-[calc(100vh-3.5rem)] sticky top-14">
      {/* Brand Header / Workspace identity */}
      <div className="p-4 border-b flex items-center space-x-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-sm">
          JEST
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-sm tracking-tight">JEST Policy CRM</span>
          <span className="text-[10px] text-muted-foreground">Enterprise Insurance Platform</span>
        </div>
      </div>

      {/* Dynamic Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {filteredNav.map((item) => {
          const hasChildren = item.children && item.children.length > 0;
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const isExpanded = openChildren[item.id];

          const filteredChildren = (item.children || []).filter((child) =>
            canAccess({
              roles: child.roles,
              permissions: child.permissions,
              featureFlag: child.featureFlag,
            })
          );

          if (hasChildren && filteredChildren.length === 0) return null;

          return (
            <div key={item.id} className="space-y-1">
              {hasChildren ? (
                <button
                  onClick={() => toggleSubmenu(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {ICON_MAP[item.icon || ''] || <ShieldAlert className="h-4 w-4" />}
                    <span>{item.title}</span>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <Link
                  href={item.href}
                  className={`flex items-center space-x-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  {ICON_MAP[item.icon || ''] || <ShieldAlert className="h-4 w-4" />}
                  <span>{item.title}</span>
                </Link>
              )}

              {/* Sub-menu rendering */}
              {hasChildren && isExpanded && (
                <div className="pl-6 space-y-1">
                  {filteredChildren.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={`block px-3 py-1.5 text-xs rounded-md transition-colors ${
                          isChildActive
                            ? 'bg-primary/15 text-primary font-semibold'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        }`}
                      >
                        {child.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t text-[11px] text-muted-foreground flex justify-between items-center">
        <span>v1.0.0 Enterprise</span>
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 border border-emerald-500/20">
          Operational
        </span>
      </div>
    </aside>
  );
}
