import React from 'react';
import { LucideIcon, TrendingUp } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  change: string;
  icon: LucideIcon;
  color: string;
}

export default function KpiCard({ label, value, change, icon: Icon, color }: KpiCardProps) {
  return (
    <div className="glass rounded-xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-800">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </span>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="mt-4">
        <span className="text-3xl font-bold text-white tracking-tight">
          {value}
        </span>
        <p className="mt-1 text-xs text-slate-500 font-medium flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-indigo-400" />
          {change}
        </p>
      </div>
    </div>
  );
}
