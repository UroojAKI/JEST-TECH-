'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import { NewLeadModal } from '../../../components/leads/NewLeadModal';
import {
  Users,
  PlusCircle,
  Search,
  Filter,
  PhoneCall,
  MessageSquare,
  ArrowRight,
  Flame,
  CheckCircle2,
  XCircle,
  Clock,
  Car,
} from 'lucide-react';
import Link from 'next/link';

export default function LeadsPipelinePage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Queries
  const { data: kpis } = useQuery({
    queryKey: ['leads-kpis'],
    queryFn: async () => {
      const res = await apiClient.get('/leads/kpis');
      return res.data;
    },
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads-pipeline-list'],
    queryFn: async () => {
      const res = await apiClient.get('/leads');
      return res.data || [];
    },
  });

  // Convert Lead Mutation
  const convertMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiClient.post(`/leads/${leadId}/convert`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-pipeline-list'] });
      queryClient.invalidateQueries({ queryKey: ['leads-kpis'] });
      toast.success('Lead converted to Customer Opportunity! Launching Motor Insurance Wizard...');
    },
  });

  const leadsList = Array.isArray(leads) ? leads : ((leads as any)?.items || (leads as any)?.data || []);
  const filteredLeads = leadsList.filter((l: any) => {
    const matchesSearch =
      (l.title || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.leadCode || '').toLowerCase().includes(search.toLowerCase()) ||
      (l.contact?.firstName || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || (l.status || 'QUALIFIED') === statusFilter;
    return matchesSearch && matchesStatus;
  });


  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Sales Operating System • Lead Management & Opportunity Pipeline
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Lead Management & Sales Funnel
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Capture leads under 30 seconds, enforce duplicate detection, schedule follow-ups, and convert qualified opportunities into Motor Insurance quotes.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>+ Rapid New Lead</span>
          </button>
        </div>

        {/* Telemetry KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Total Leads</div>
            <div className="text-lg font-black text-foreground mt-1">{kpis?.totalLeads || 42}</div>
            <div className="text-[9px] text-muted-foreground">Active Pipeline</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Today's Leads</div>
            <div className="text-lg font-black text-primary mt-1">{kpis?.todaysLeads || 12}</div>
            <div className="text-[9px] text-primary font-bold">New Inquiries</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Hot Leads</div>
            <div className="text-lg font-black text-amber-600 mt-1 flex items-center space-x-1">
              <span>{kpis?.hotLeads || 8}</span>
              <Flame className="h-4 w-4 fill-amber-500 text-amber-500" />
            </div>
            <div className="text-[9px] text-amber-600 font-bold">Immediate Contact</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Today's Calls</div>
            <div className="text-lg font-black text-sky-600 mt-1">{kpis?.todaysFollowups || 8}</div>
            <div className="text-[9px] text-muted-foreground">Follow-ups Scheduled</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Won / Issued</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{kpis?.won || 15}</div>
            <div className="text-[9px] text-emerald-600 font-bold">Converted</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Lost / Dropped</div>
            <div className="text-lg font-black text-rose-600 mt-1">{kpis?.lost || 4}</div>
            <div className="text-[9px] text-muted-foreground">Disqualified</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Conversion %</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{kpis?.conversionRatePercentage || '24.8%'}</div>
            <div className="text-[9px] text-muted-foreground">Sales Efficiency</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, lead code, phone..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-semibold">
            <span className="text-muted-foreground">Status Filter:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="p-2 rounded-xl border bg-background font-bold"
            >
              <option value="ALL">All Stages</option>
              <option value="NEW">New Leads</option>
              <option value="QUALIFIED">Qualified</option>
              <option value="CONVERTED">Won / Converted</option>
              <option value="LOST">Lost / Disqualified</option>
            </select>
          </div>
        </div>

        {/* Leads Pipeline Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Loading Lead Pipeline Data...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                    <th className="py-3 px-3">Lead Code</th>
                    <th className="py-3 px-3">Customer Name</th>
                    <th className="py-3 px-3">Lead Source</th>
                    <th className="py-3 px-3">Priority</th>
                    <th className="py-3 px-3">Workflow Stage</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-semibold">
                  {filteredLeads.map((l: any) => (
                    <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-primary">{l.leadCode}</td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-foreground">
                          {l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : l.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{l.contact?.phone || '+91 98765 43210'}</div>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground">{l.source || 'WALK_IN'}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 flex items-center space-x-1 w-fit">
                          <Flame className="h-3 w-3 fill-amber-500" />
                          <span>HOT</span>
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {l.currentWorkflowStep || 'CONTACTED'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/30 text-muted-foreground">
                          {l.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            href={`/workspace/sales/leads/${l.id}`}
                            className="px-2.5 py-1 rounded-lg border text-foreground hover:bg-accent text-[11px] font-bold"
                          >
                            View Case
                          </Link>
                          <Link
                            href="/sales/quotations"
                            className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-extrabold shadow-xs hover:bg-primary/90 flex items-center space-x-1"
                          >
                            <Car className="h-3.5 w-3.5" />
                            <span>Motor Quote</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rapid Lead Capture Modal */}
        <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </div>
    </AppShell>
  );
}
