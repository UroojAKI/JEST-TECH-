import React from 'react';

interface Activity {
  id: string;
  event: string;
  details: string;
  time: string;
  badge: string;
}

interface NotificationCardProps {
  title: string;
  activities: Activity[];
}

export default function NotificationCard({ title, activities }: NotificationCardProps) {
  const getBadgeStyle = (badge: string) => {
    switch (badge.toUpperCase()) {
      case 'CALL':
        return 'bg-emerald-500/20 text-emerald-400';
      case 'MEETING':
        return 'bg-indigo-500/20 text-indigo-400';
      case 'EMAIL':
        return 'bg-amber-500/20 text-amber-400';
      default:
        return 'bg-slate-500/20 text-slate-400';
    }
  };

  return (
    <div className="glass rounded-xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-6">
        {title}
      </h3>
      <div className="space-y-4">
        {activities.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No recent activity found.</p>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="flex items-start justify-between border-b border-slate-900 pb-3 last:border-0 last:pb-0"
            >
              <div>
                <h4 className="text-xs font-bold text-white">{act.event}</h4>
                <p className="text-[10px] text-slate-500 mt-0.5">{act.details}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${getBadgeStyle(act.badge)}`}>
                  {act.badge}
                </span>
                <p className="text-[9px] text-slate-600 mt-1">{act.time}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
