'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWorkspace } from '../../hooks/useWorkspace';
import * as Icons from 'lucide-react';

export function WorkspaceSidebar() {
  const pathname = usePathname();
  const { navigation, jobRole } = useWorkspace();

  const getIcon = (iconName?: string) => {
    if (!iconName) return Icons.FileText;
    const Icon = (Icons as any)[iconName];
    return Icon || Icons.FileText;
  };

  return (
    <aside className="w-64 border-r bg-card text-card-foreground flex flex-col h-[calc(100vh-4rem)] sticky top-16 shadow-xs">
      {/* Sidebar Role Banner */}
      <div className="p-3 border-b bg-muted/20 text-xs">
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
          Active Workspace
        </div>
        <div className="font-extrabold text-foreground truncate mt-0.5">
          {jobRole?.name || 'Enterprise Workspace'}
        </div>
      </div>

      {/* Dynamic Navigation List */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 text-xs">
        {navigation.map((item) => {
          const Icon = getIcon(item.icon);
          const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

          return (
            <div key={item.id} className="space-y-1">
              <Link
                href={item.href}
                className={`flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.title}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-primary/20 text-primary">
                    {item.badge}
                  </span>
                )}
              </Link>

              {item.children && item.children.length > 0 && (
                <div className="pl-6 space-y-0.5">
                  {item.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    const ChildIcon = getIcon(child.icon);

                    return (
                      <Link
                        key={child.id}
                        href={child.href}
                        className={`flex items-center space-x-2 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors ${
                          isChildActive
                            ? 'text-primary font-bold bg-primary/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <ChildIcon className="h-3 w-3 shrink-0" />
                        <span className="truncate">{child.title}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
