'use client';

import React from 'react';
import Link from 'next/link';
import {
  UserPlus,
  FileSpreadsheet,
  ShieldCheck,
  FileText,
  Users,
  Settings,
  Zap,
} from 'lucide-react';
import { QUICK_ACTION_REGISTRY } from '../quick-action-registry';
import { usePermissions } from '../../providers/permission-provider';

const ICON_MAP: Record<string, React.ReactNode> = {
  UserPlus: <UserPlus className="h-4 w-4 mr-1.5" />,
  FileSpreadsheet: <FileSpreadsheet className="h-4 w-4 mr-1.5" />,
  ShieldCheck: <ShieldCheck className="h-4 w-4 mr-1.5" />,
  FileText: <FileText className="h-4 w-4 mr-1.5" />,
  Users: <Users className="h-4 w-4 mr-1.5" />,
  Settings: <Settings className="h-4 w-4 mr-1.5" />,
};

export function RoleQuickActionsWidget() {
  const { canAccess } = usePermissions();

  const availableActions = QUICK_ACTION_REGISTRY.filter((action) =>
    canAccess({
      roles: action.roles,
      permissions: action.permissions,
    })
  );

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
      <div className="flex items-center space-x-2">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <Zap className="h-4 w-4" />
        </div>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Action Toolbar</h3>
          <p className="text-[11px] text-muted-foreground">Tailored workflow triggers for your active role</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
        {availableActions.map((action) => (
          <Link
            key={action.id}
            href={action.href}
            className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors shadow-sm ${
              action.variant === 'primary'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : action.variant === 'secondary'
                ? 'bg-secondary text-secondary-foreground hover:bg-secondary/90'
                : 'border bg-background hover:bg-accent text-foreground'
            }`}
          >
            {ICON_MAP[action.icon]}
            <span>{action.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
