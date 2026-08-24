'use client';

import React from 'react';
import Link from 'next/link';
import { useWorkspace } from '../../hooks/useWorkspace';
import { usePermissions } from '../providers/permission-provider';
import { WidgetRenderer } from './WidgetRenderer';
import * as Icons from 'lucide-react';

export function DashboardRenderer() {
  const { workspace, widgets, quickActions, jobRole, department } = useWorkspace();
  const { canAccess } = usePermissions();

  const getIcon = (iconName?: string) => {
    if (!iconName) return Icons.Zap;
    const Icon = (Icons as any)[iconName];
    return Icon || Icons.Zap;
  };

  return (
    <div className="space-y-6">
      {/* Workspace Role & Header Banner */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-primary">
              {department?.name || 'Enterprise Platform'} • {jobRole?.name || 'Command Center'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              {workspace?.title || 'Department Workspace Dashboard'}
            </h1>
            {workspace?.subtitle && (
              <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
                {workspace.subtitle}
              </p>
            )}
          </div>

          {/* Quick Actions Triggers */}
          {quickActions && quickActions.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {quickActions
                .filter((action: any) => canAccess({ permissions: action.permissions || [] }))
                .map((action: any) => {
                const Icon = getIcon(action.icon);
                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{action.title}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Widget Grid */}
      <div className="grid grid-cols-12 gap-4">
        {widgets && widgets.length > 0 ? (
          widgets.map((widget: any) => (
            <WidgetRenderer key={widget.id} widget={widget} />
          ))
        ) : (
          <div className="col-span-12 p-8 text-center border rounded-2xl bg-card text-muted-foreground text-xs font-semibold">
            No specific widgets configured for this workspace in the Dashboard Registry.
          </div>
        )}
      </div>
    </div>
  );
}
