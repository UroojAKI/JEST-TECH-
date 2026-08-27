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
  Clock,
  Car,
} from 'lucide-react';
import Link from 'next/link';

export default function SalesLeadsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const { data: leadsData = [], isLoading } = useQuery({
    queryKey: ['sales-leads-list'],
    queryFn: async () => {
      const res = await apiClient.get('/leads');
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });

  const leads = Array.isArray(leadsData) ? leadsData : [];

  const filteredLeads = leads.filter((lead: any) => {
    const matchesSearch =
      !search ||
      `${lead.firstName} ${lead.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (lead.phone && lead.phone.includes(search)) ||
      (lead.leadCode && lead.leadCode.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || lead.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <AppShell activeWorkspace="SALES">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Users className="h-6 w-6 text-primary" />
              Sales Leads & Pipeline
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Active sales prospects, follow-up stages, and quotation conversion pipeline.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-xs font-black rounded-xl hover:bg-primary/90 transition shadow-sm"
          >
            <PlusCircle className="h-4 w-4" />
            New Sales Lead
          </button>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by customer name, phone number, or lead code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New Leads</option>
              <option value="CONTACTED">Contacted</option>
              <option value="QUOTED">Quoted</option>
              <option value="CONVERTED">Converted</option>
              <option value="LOST">Lost</option>
            </select>
          </div>
        </div>

        {/* Leads Table */}
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b font-bold text-muted-foreground uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">Lead Code</th>
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Product / Vehicle</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      Loading sales leads...
                    </td>
                  </tr>
                ) : filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground">
                      No sales leads found matching your filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead: any) => (
                    <tr key={lead.id} className="hover:bg-muted/20 transition">
                      <td className="px-5 py-3.5 font-mono font-bold text-primary">
                        {lead.leadCode || 'LEAD-NEW'}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-foreground">
                          {lead.firstName} {lead.lastName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">{lead.phone || lead.email || 'No contact info'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-foreground">{lead.productInterest || 'Motor Insurance'}</div>
                        <div className="text-[10px] text-muted-foreground">{lead.vehicleRegistrationNumber || 'Individual Policy'}</div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                          {lead.currentWorkflowStep || 'DISCOVERY'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            lead.status === 'CONVERTED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : lead.status === 'LOST'
                              ? 'bg-red-500/10 text-red-600'
                              : 'bg-blue-500/10 text-blue-600'
                          }`}
                        >
                          {lead.status || 'NEW'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right space-x-2">
                        <Link
                          href={`/sales/quotations?leadId=${lead.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground font-extrabold text-[11px] hover:bg-primary/90 transition"
                        >
                          Create Quote
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && <NewLeadModal isOpen={showModal} onClose={() => setShowModal(false)} />}
    </AppShell>
  );
}
