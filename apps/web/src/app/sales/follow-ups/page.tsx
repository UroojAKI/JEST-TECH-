'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { AppShell } from '../../../components/layout/app-shell';
import {
  Clock,
  PhoneCall,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

export default function SalesFollowUpsPage() {
  const [filter, setFilter] = useState<'ALL' | 'TODAY' | 'OVERDUE' | 'UPCOMING'>('ALL');
  const [search, setSearch] = useState('');

  const { data: followUpsData = [], isLoading } = useQuery({
    queryKey: ['sales-follow-ups'],
    queryFn: async () => {
      const res = await apiClient.get('/leads');
      const leads = Array.isArray(res.data) ? res.data : res.data?.data || [];
      return leads.filter((l: any) => l.status === 'CONTACTED' || l.status === 'NEW' || l.status === 'QUOTED');
    },
  });

  const followUps = Array.isArray(followUpsData) ? followUpsData : [];

  return (
    <AppShell activeWorkspace="SALES">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Clock className="h-6 w-6 text-primary" />
              Follow-ups & Client Callbacks
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled customer callback tasks, quotation follow-up reminders, and priority calls.
            </p>
          </div>
        </div>

        {/* Status Filter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { id: 'ALL', label: 'All Follow-ups', count: followUps.length, color: 'text-foreground' },
            { id: 'TODAY', label: 'Due Today', count: Math.min(followUps.length, 3), color: 'text-primary' },
            { id: 'OVERDUE', label: 'Overdue', count: 1, color: 'text-red-600' },
            { id: 'UPCOMING', label: 'Upcoming 7 Days', count: Math.max(0, followUps.length - 4), color: 'text-emerald-600' },
          ].map((card) => (
            <button
              key={card.id}
              onClick={() => setFilter(card.id as any)}
              className={`p-4 rounded-2xl border bg-card text-left transition-all hover:border-primary/50 shadow-xs ${
                filter === card.id ? 'ring-2 ring-primary/20 border-primary' : ''
              }`}
            >
              <span className="text-[11px] font-bold text-muted-foreground block">{card.label}</span>
              <span className={`text-xl font-black ${card.color} mt-1 block`}>{card.count}</span>
            </button>
          ))}
        </div>

        {/* Task List */}
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
            <span className="text-xs font-extrabold text-foreground">Follow-up Task Queue</span>
            <span className="text-[11px] text-muted-foreground font-semibold">{followUps.length} Pending Tasks</span>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                Loading follow-up queue...
              </div>
            ) : followUps.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                No follow-up tasks currently pending. All customer interactions are up to date!
              </div>
            ) : (
              followUps.map((lead: any) => (
                <div key={lead.id} className="p-4 flex items-center justify-between hover:bg-muted/10 transition gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-extrabold text-xs text-foreground">
                          {lead.firstName} {lead.lastName}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/10 text-primary">
                          {lead.leadCode || 'LEAD'}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Phone: {lead.phone || 'N/A'} • Product: {lead.productInterest || 'Motor Comprehensive'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Link
                      href={`/sales/quotations?leadId=${lead.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition shadow-xs"
                    >
                      Open Quote
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
