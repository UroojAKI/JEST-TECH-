import React from 'react';
import { CalendarDays, AlertTriangle, ShieldAlert, CheckCircle, RefreshCcw } from 'lucide-react';

interface RenewalData {
  expiring20: number;
  expiring30: number;
  expiring45: number;
  expired: number;
  renewed: number;
}

interface RenewalCardProps {
  renewals: RenewalData;
}

export default function RenewalCard({ renewals }: RenewalCardProps) {
  const items = [
    { label: 'Expiring in 20 Days', count: renewals?.expiring20 || 0, icon: ShieldAlert, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Expiring in 30 Days', count: renewals?.expiring30 || 0, icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Expiring in 45 Days', count: renewals?.expiring45 || 0, icon: CalendarDays, color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
    { label: 'Lapsed / Expired', count: renewals?.expired || 0, icon: ShieldAlert, color: 'text-red-500', bg: 'bg-red-500/10' },
    { label: 'Successfully Renewed', count: renewals?.renewed || 0, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  ];

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6 flex items-center gap-2">
        <RefreshCcw className="h-4 w-4 text-indigo-500" />
        Renewal Performance & Alerts
      </h3>
      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between border-b border-slate-900 pb-3 last:border-0 last:pb-0">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${item.bg}`}>
                <item.icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <span className="text-xs font-bold text-slate-200">{item.label}</span>
            </div>
            <span className="text-sm font-black text-white bg-slate-900 px-3 py-1 rounded-md">
              {item.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
