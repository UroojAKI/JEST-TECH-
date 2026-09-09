'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '../../../components/layout/app-shell';
import { HelpCircle, Plus, BookOpen, ShieldCheck, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';

interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdAt: string;
}

export default function AgentSupportPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [description, setDescription] = useState('');

  const { data: tickets = [], isLoading, isError } = useQuery<SupportTicket[]>({
    queryKey: ['portal-support-tickets'],
    queryFn: async () => {
      const res = await apiClient.get('/portal/support/tickets');
      return Array.isArray(res.data) ? res.data : (res.data?.data || []);
    },
    staleTime: 30 * 1000,
  });

  const createTicketMutation = useMutation({
    mutationFn: async (payload: { subject: string; priority: string; description: string }) => {
      const res = await apiClient.post('/portal/support/tickets', payload);
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Support ticket ${data?.ticketNumber || 'submitted'} created successfully!`);
      setShowForm(false);
      setSubject('');
      setPriority('MEDIUM');
      setDescription('');
      queryClient.invalidateQueries({ queryKey: ['portal-support-tickets'] });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to submit support ticket. Please try again.';
      toast.error(msg);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !description.trim()) {
      toast.error('Subject and description are required.');
      return;
    }
    createTicketMutation.mutate({ subject, priority, description });
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'URGENT':
        return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      case 'HIGH':
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'LOW':
        return 'bg-muted text-muted-foreground border-border';
      default:
        return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'RESOLVED':
      case 'CLOSED':
        return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'IN_PROGRESS':
        return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
      default:
        return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex justify-between items-center border-b pb-4 text-xs">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" /> Support Desk & POSP Training Center
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Raise branch support tickets, track ticket resolution, and review certification status
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>{showForm ? 'Close Form' : '+ Raise Support Ticket'}</span>
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="p-5 border rounded-2xl bg-card shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-foreground">Raise Support Ticket</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Subject *</label>
                <input
                  required
                  className="w-full p-2.5 border rounded-xl bg-background focus:ring-1 focus:ring-primary outline-none"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary of the issue or inquiry"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Priority *</label>
                <select
                  className="w-full p-2.5 border rounded-xl bg-background focus:ring-1 focus:ring-primary outline-none"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="LOW">LOW — General Inquiry</option>
                  <option value="MEDIUM">MEDIUM — Standard Request</option>
                  <option value="HIGH">HIGH — Policy / Endorsement Blocker</option>
                  <option value="URGENT">URGENT — Issuance Failure / Critical</option>
                </select>
              </div>
              <div className="md:col-span-2 space-y-1">
                <label className="font-semibold text-foreground">Description *</label>
                <textarea
                  required
                  className="w-full p-2.5 border rounded-xl bg-background focus:ring-1 focus:ring-primary outline-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  placeholder="Provide full details, quotation/policy numbers, and error descriptions..."
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl border hover:bg-muted transition-colors"
                disabled={createTicketMutation.isPending}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTicketMutation.isPending}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {createTicketMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>{createTicketMutation.isPending ? 'Submitting...' : 'Submit Ticket'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Support Tickets Section */}
        <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Active & Historical Tickets
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Tickets submitted to operations and support desk</p>
            </div>
            <span className="text-xs font-bold text-muted-foreground">
              {tickets.length} ticket{tickets.length === 1 ? '' : 's'}
            </span>
          </div>

          {isLoading ? (
            <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Loading tickets...</span>
            </div>
          ) : isError ? (
            <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-600 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>Failed to fetch support tickets. Please refresh or verify API connection.</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-xs text-muted-foreground border rounded-xl border-dashed">
              No support tickets found. Click "+ Raise Support Ticket" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-semibold">
                    <th className="py-2.5 px-3">Ticket ID</th>
                    <th className="py-2.5 px-3">Subject</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-primary">{t.ticketNumber}</td>
                      <td className="py-2.5 px-3 font-medium text-foreground max-w-xs truncate">{t.subject}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getPriorityBadge(t.priority)}`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${getStatusBadge(t.status)}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Information Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> POSP Certification Status
            </h3>
            <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold flex justify-between items-center">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>IRDAI POSP License Active</span>
              </div>
              <span className="font-mono text-xs">CERT-881200</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              License valid through 31-Dec-2027. Re-certification refresher due in 14 months.
            </p>
          </div>

          <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-primary" /> Product Training Modules
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 font-medium">
                <span>Motor Underwriting & Addons 101</span>
                <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 font-medium">
                <span>Group Health Optima Masterclass</span>
                <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40 font-medium">
                <span>IRDAI POSP Guidelines & Code of Conduct</span>
                <span className="text-emerald-600 font-bold text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Completed
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
