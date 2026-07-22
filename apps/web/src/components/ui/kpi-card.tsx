'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  description?: string;
}

export function KpiCard({
  title,
  value,
  change,
  changeLabel = 'vs last month',
  icon,
  description,
}: KpiCardProps) {
  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm space-y-3 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</span>
        {icon && <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>}
      </div>

      <div className="flex items-baseline justify-between">
        <div className="text-2xl font-extrabold tracking-tight text-foreground">{value}</div>
        {change !== undefined && (
          <div
            className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
              isPositive
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : isNegative
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : isNegative ? (
              <TrendingDown className="h-3 w-3 mr-1" />
            ) : (
              <Minus className="h-3 w-3 mr-1" />
            )}
            <span>{change > 0 ? `+${change}%` : `${change}%`}</span>
          </div>
        )}
      </div>

      {(description || changeLabel) && (
        <p className="text-[11px] text-muted-foreground">
          {description || changeLabel}
        </p>
      )}
    </div>
  );
}
