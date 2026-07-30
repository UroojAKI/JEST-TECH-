'use client';

import React from 'react';
import Link from 'next/link';
import {
  Car,
  RefreshCw,
  UserPlus,
  FileSpreadsheet,
  Users,
  PhoneCall,
} from 'lucide-react';

interface QuickActionsBarProps {
  onNewCustomerClick?: () => void;
  onFollowupsClick?: () => void;
}

export function QuickActionsBar({ onNewCustomerClick, onFollowupsClick }: QuickActionsBarProps) {
  const actions = [
    {
      label: 'New Motor Insurance',
      href: '/sales/quotations',
      icon: Car,
      color: 'bg-primary text-primary-foreground hover:bg-primary/90',
    },
    {
      label: 'Renew Policy',
      href: '/portal/renewals',
      icon: RefreshCw,
      color: 'bg-emerald-600 text-white hover:bg-emerald-700',
    },
    {
      label: 'New Customer',
      onClick: onNewCustomerClick,
      icon: UserPlus,
      color: 'bg-accent text-foreground hover:bg-accent/80 border',
    },
    {
      label: 'Draft Quotations',
      href: '/sales/quotations',
      icon: FileSpreadsheet,
      color: 'bg-card text-foreground hover:bg-accent border',
    },
    {
      label: 'My Leads',
      href: '/crm/leads',
      icon: Users,
      color: 'bg-card text-foreground hover:bg-accent border',
    },
    {
      label: 'Today\'s Follow-ups',
      onClick: onFollowupsClick,
      icon: PhoneCall,
      color: 'bg-sky-600 text-white hover:bg-sky-700',
    },
  ];

  return (
    <div className="space-y-2">
      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
        Quick Operational Actions
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {actions.map((act, idx) => {
          const Icon = act.icon;
          const content = (
            <div className="flex items-center space-x-2">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{act.label}</span>
            </div>
          );

          if (act.href) {
            return (
              <Link
                key={idx}
                href={act.href}
                className={`p-3 rounded-2xl text-xs font-black shadow-xs transition-all flex items-center justify-center ${act.color}`}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={idx}
              type="button"
              onClick={act.onClick}
              className={`p-3 rounded-2xl text-xs font-black shadow-xs transition-all flex items-center justify-center ${act.color}`}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
