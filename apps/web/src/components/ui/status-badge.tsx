'use client';

import React from 'react';

export type DomainStatus =
  | 'ACTIVE'
  | 'LAPSED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PAID'
  | 'CONVERTED'
  | 'PENDING';

const STATUS_CONFIG: Record<DomainStatus, { label: string; className: string }> = {
  ACTIVE: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  LAPSED: { label: 'Lapsed', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  EXPIRED: { label: 'Expired', className: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  CANCELLED: { label: 'Cancelled', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  UNDER_REVIEW: { label: 'Under Review', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' },
  PAID: { label: 'Paid', className: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' },
  CONVERTED: { label: 'Converted', className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20' },
  PENDING: { label: 'Pending', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
};

export function StatusBadge({ status }: { status: DomainStatus | string }) {
  const config = STATUS_CONFIG[status as DomainStatus] || {
    label: status,
    className: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.className}`}
    >
      {config.label}
    </span>
  );
}
