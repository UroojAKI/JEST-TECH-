import React from 'react';
import {
  Sparkles,
  Users,
  FileText,
  ShieldCheck,
  AlertOctagon,
  UserPlus,
  FileSpreadsheet,
  FileCheck,
  LucideIcon,
} from 'lucide-react';

import { useRouter } from 'next/navigation';

interface Action {
  action: string;
  label: string;
  icon: string;
  href?: string;
}

interface QuickActionCardProps {
  actions: Action[];
}

export default function QuickActionCard({ actions }: QuickActionCardProps) {
  const router = useRouter();

  const getIcon = (iconName: string): LucideIcon => {
    switch (iconName) {
      case 'Sparkles':
        return Sparkles;
      case 'Users':
        return Users;
      case 'FileText':
        return FileText;
      case 'ShieldCheck':
        return ShieldCheck;
      case 'AlertOctagon':
        return AlertOctagon;
      case 'UserPlus':
        return UserPlus;
      case 'FileSpreadsheet':
        return FileSpreadsheet;
      case 'FileCheck':
        return FileCheck;
      default:
        return Sparkles;
    }
  };

  const ACTION_ROUTES: Record<string, string> = {
    CREATE_USER: '/admin/users',
    VIEW_AUDIT_LOGS: '/admin/audit',
    NEW_LEAD: '/crm/leads',
    CREATE_QUOTATION: '/sales/quotations',
    ISSUE_POLICY: '/policies',
    LODGE_CLAIM: '/claims',
  };

  const handleActionClick = (actionName: string, href?: string) => {
    const targetRoute = href || ACTION_ROUTES[actionName];
    if (targetRoute) router.push(targetRoute);
  };

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
        Quick Action Controls
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((act) => {
          const Icon = getIcon(act.icon);
          const targetRoute = act.href || ACTION_ROUTES[act.action];
          return (
            <button
              key={act.action}
              type="button"
              disabled={!targetRoute}
              title={!targetRoute ? 'This action is not available yet' : act.label}
              onClick={() => handleActionClick(act.action, act.href)}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-900/40 hover:-translate-y-0.5 transition-all text-center cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-slate-950/20"
            >
              <Icon className="h-5 w-5 text-indigo-400 mb-2" />
              <span className="text-xs font-bold text-white leading-tight">{act.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
