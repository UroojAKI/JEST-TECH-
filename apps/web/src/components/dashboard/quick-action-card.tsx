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

interface Action {
  action: string;
  label: string;
  icon: string;
}

interface QuickActionCardProps {
  actions: Action[];
}

export default function QuickActionCard({ actions }: QuickActionCardProps) {
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

  const handleActionClick = (actionName: string) => {
    alert(`Quick Action executed: ${actionName}. Future sprints will link this to live dialog modals.`);
  };

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
        Quick Action Controls
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((act) => {
          const Icon = getIcon(act.icon);
          return (
            <button
              key={act.action}
              onClick={() => handleActionClick(act.action)}
              className="flex flex-col items-center justify-center p-4 rounded-xl border border-slate-900 bg-slate-950/20 hover:border-slate-800 hover:bg-slate-900/40 hover:-translate-y-0.5 transition-all text-center cursor-pointer"
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
