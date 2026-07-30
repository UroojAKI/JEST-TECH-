'use client';

import React from 'react';
import {
  FileSpreadsheet,
  FileText,
  CreditCard,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface AgentWorkQueueProps {
  tasks?: {
    pendingQuotations: number;
    pendingDocuments: number;
    paymentPending: number;
    policyIssuancePending: number;
    renewalsDueToday: number;
  };
  onSelectFilter?: (filterKey: string) => void;
  activeFilter?: string;
}

export function AgentWorkQueue({ tasks, onSelectFilter, activeFilter }: AgentWorkQueueProps) {
  const queue = tasks || {
    pendingQuotations: 6,
    pendingDocuments: 3,
    paymentPending: 2,
    policyIssuancePending: 4,
    renewalsDueToday: 5,
  };

  const queueItems = [
    {
      key: 'QUOTATION',
      title: 'Pending Quotations',
      count: queue.pendingQuotations,
      badgeColor: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
      icon: FileSpreadsheet,
      desc: 'Quote prep & comparison',
    },
    {
      key: 'PROPOSAL',
      title: 'Pending Documents',
      count: queue.pendingDocuments,
      badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
      icon: FileText,
      desc: 'RC / KYC upload needed',
    },
    {
      key: 'PAYMENT',
      title: 'Payment Pending',
      count: queue.paymentPending,
      badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      icon: CreditCard,
      desc: 'Awaiting customer payment',
    },
    {
      key: 'ISSUED',
      title: 'Policy Issuance',
      count: queue.policyIssuancePending,
      badgeColor: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
      icon: ShieldCheck,
      desc: 'Paid, PDF sync pending',
    },
    {
      key: 'REFERRAL',
      title: 'Renewals Due Today',
      count: queue.renewalsDueToday,
      badgeColor: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
      icon: RefreshCw,
      desc: 'Expiring in < 24 hrs',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
            Actionable Work Queue
          </span>
          <h3 className="text-sm font-extrabold text-foreground tracking-tight">
            My Action Tasks & Cases
          </h3>
        </div>
        {activeFilter && (
          <button
            onClick={() => onSelectFilter?.('')}
            className="text-xs font-bold text-muted-foreground hover:text-foreground"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {queueItems.map((item) => {
          const Icon = item.icon;
          const isSelected = activeFilter === item.key;

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectFilter?.(isSelected ? '' : item.key)}
              className={`p-3.5 rounded-2xl border text-left transition-all relative ${
                isSelected
                  ? 'border-primary bg-primary/10 ring-1 ring-primary shadow-xs'
                  : 'bg-card hover:border-primary/50 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${item.badgeColor}`}
                >
                  {item.count} Cases
                </span>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="text-xs font-extrabold text-foreground mt-2 truncate">
                {item.title}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {item.desc}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
