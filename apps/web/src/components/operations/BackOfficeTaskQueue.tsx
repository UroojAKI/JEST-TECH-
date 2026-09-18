'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Clock,
  UserCheck,
  Car,
  FileCheck2,
  ShieldCheck,
  AlertTriangle,
  Search,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { taskRepository, BackOfficeQueueItem } from '../../repositories/task.repository';

export function BackOfficeTaskQueue() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedTask, setSelectedTask] = useState<BackOfficeQueueItem | null>(null);
  const [resolutionAction, setResolutionAction] = useState<'VERIFIED' | 'REJECTED' | null>(null);
  const [notes, setNotes] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['backoffice-task-queue', statusFilter],
    queryFn: () =>
      taskRepository.getBackOfficeQueue({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      }),
    staleTime: 15_000,
  });

  const queue = data?.queue || [];
  const total = data?.total || 0;

  // Resolve mutation
  const resolveMutation = useMutation({
    mutationFn: ({ id, status, verificationNotes, rejectedReason }: { id: string; status: string; verificationNotes?: string; rejectedReason?: string }) =>
      taskRepository.resolveBackOfficeTask(id, { status, verificationNotes, rejectedReason }),
    onSuccess: (_, vars) => {
      toast.success(`Task resolved as ${vars.status}`);
      setSelectedTask(null);
      setResolutionAction(null);
      setNotes('');
      void queryClient.invalidateQueries({ queryKey: ['backoffice-task-queue'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update task');
    },
  });

  const filteredQueue = queue.filter((item) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    const taskCode = (item.taskCode || '').toLowerCase();
    const leadCode = (item.lead?.leadCode || '').toLowerCase();
    const customerName = `${item.lead?.customer?.firstName || ''} ${item.lead?.customer?.lastName || ''}`.toLowerCase();
    const regNo = (item.motorQuotation?.vehicle?.registrationNumber || '').toLowerCase();
    return taskCode.includes(term) || leadCode.includes(term) || customerName.includes(term) || regNo.includes(term);
  });

  const pendingCount = queue.filter((t) => t.status === 'PENDING').length;
  const inReviewCount = queue.filter((t) => t.status === 'IN_REVIEW').length;
  const verifiedCount = queue.filter((t) => t.status === 'VERIFIED').length;
  const rejectedCount = queue.filter((t) => t.status === 'REJECTED').length;

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span>Back-Office Operations Verification Queue</span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Strict verification pipeline for leads transitioning through Back Office verification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void refetch()}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-xs transition"
          >
            {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Metrics Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setStatusFilter('PENDING')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'PENDING'
              ? 'ring-2 ring-amber-500 bg-amber-500/10 border-amber-500/30'
              : 'bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-amber-600">Pending Review</div>
          <div className="text-2xl font-black text-amber-700">{pendingCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('IN_REVIEW')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'IN_REVIEW'
              ? 'ring-2 ring-blue-500 bg-blue-500/10 border-blue-500/30'
              : 'bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-blue-600">In Review</div>
          <div className="text-2xl font-black text-blue-700">{inReviewCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('VERIFIED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'VERIFIED'
              ? 'ring-2 ring-emerald-500 bg-emerald-500/10 border-emerald-500/30'
              : 'bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-emerald-600">Verified</div>
          <div className="text-2xl font-black text-emerald-700">{verifiedCount}</div>
        </div>

        <div
          onClick={() => setStatusFilter('REJECTED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-1 ${
            statusFilter === 'REJECTED'
              ? 'ring-2 ring-rose-500 bg-rose-500/10 border-rose-500/30'
              : 'bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10'
          }`}
        >
          <div className="text-[10px] uppercase font-bold text-rose-600">Rejected / Returned</div>
          <div className="text-2xl font-black text-rose-700">{rejectedCount}</div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold">
          {[
            { id: 'ALL', label: 'All Tasks' },
            { id: 'PENDING', label: 'Pending' },
            { id: 'IN_REVIEW', label: 'In Review' },
            { id: 'VERIFIED', label: 'Verified' },
            { id: 'REJECTED', label: 'Rejected' },
            { id: 'COMPLETED', label: 'Completed' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                  : 'bg-card text-muted-foreground hover:bg-accent border-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search task, lead, reg no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Task Queue List */}
      {filteredQueue.length === 0 && !isLoading ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-2 shadow-xs">
          <FileCheck2 className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-bold text-base">No Back-Office Tasks in this Queue</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            When sales leads reach Back Office verification or quotation gates, operational tasks appear here automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredQueue.map((item) => {
            const customerName = item.lead?.customer
              ? `${item.lead.customer.firstName} ${item.lead.customer.lastName || ''}`.trim()
              : 'Unknown Customer';
            const vehicle = item.motorQuotation?.vehicle;

            return (
              <div
                key={item.id}
                className="rounded-xl border bg-card p-4 transition-all shadow-xs hover:border-primary/40 space-y-3"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Task Header info */}
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        {item.taskCode}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : item.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : item.status === 'IN_REVIEW'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {item.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                        item.priority === 'URGENT'
                          ? 'bg-rose-500/10 text-rose-600'
                          : item.priority === 'HIGH'
                          ? 'bg-amber-500/10 text-amber-600'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {item.priority} Priority
                      </span>
                      <span className="text-xs text-muted-foreground">
                        Type: <span className="font-semibold text-foreground">{item.taskType}</span>
                      </span>
                    </div>

                    {/* Customer & Lead link */}
                    <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground pt-1">
                      {item.lead?.customer && (
                        <Link
                          href={`/crm/customers/${item.lead.customer.id}`}
                          className="font-bold text-foreground hover:underline flex items-center gap-1"
                        >
                          <span>{customerName}</span>
                          <span className="font-mono text-[11px] text-muted-foreground">({item.lead.customer.customerCode})</span>
                        </Link>
                      )}
                      {item.lead && (
                        <Link
                          href={`/crm/leads/${item.lead.id}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          <span>Lead: {item.lead.leadCode}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {item.lead?.agent && (
                        <span className="text-[11px]">
                          Agent: <span className="font-mono font-semibold text-foreground">{item.lead.agent.agentCode}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Vehicle & Quotation quick badges */}
                  <div className="flex items-center gap-3">
                    {vehicle && (
                      <div className="text-right">
                        <span className="font-mono text-xs font-black tracking-widest px-2 py-0.5 rounded bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border">
                          {vehicle.registrationNumber}
                        </span>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
                        </div>
                      </div>
                    )}
                    {item.motorQuotation && (
                      <div className="text-right pl-3 border-l border-border">
                        <span className="text-xs text-muted-foreground block font-medium">Final Premium</span>
                        <span className="text-sm font-black text-foreground">
                          ₹{Number(item.motorQuotation.finalPremium).toLocaleString('en-IN')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification notes or rejection reason if present */}
                {item.verificationNotes && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                    <span className="font-bold">Verification Notes: </span>
                    {item.verificationNotes}
                  </div>
                )}
                {item.rejectedReason && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-300">
                    <span className="font-bold">Rejection Reason: </span>
                    {item.rejectedReason}
                  </div>
                )}

                {/* Action buttons */}
                {item.status !== 'VERIFIED' && item.status !== 'COMPLETED' && (
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                    <button
                      onClick={() => {
                        setSelectedTask(item);
                        setResolutionAction('REJECTED');
                        setNotes('');
                      }}
                      className="px-3 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-rose-700 text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Reject / Return to Agent</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedTask(item);
                        setResolutionAction('VERIFIED');
                        setNotes('All KYC documents, vehicle inspection and payment details verified.');
                      }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Verify Task</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Resolution Modal */}
      {selectedTask && resolutionAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                {resolutionAction === 'VERIFIED' ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <span>Verify Task {selectedTask.taskCode}</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-rose-600" />
                    <span>Reject / Return Task {selectedTask.taskCode}</span>
                  </>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {resolutionAction === 'VERIFIED'
                  ? 'Confirming verification will clear the back-office gate for policy issuance.'
                  : 'Specify the rejection reason so the sales agent can address missing requirements.'}
              </p>
            </div>

            <div>
              <label className="text-xs font-bold block mb-1">
                {resolutionAction === 'VERIFIED' ? 'Verification Notes' : 'Rejection Reason *'}
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={
                  resolutionAction === 'VERIFIED'
                    ? 'Enter any internal verification notes...'
                    : 'e.g., Vehicle inspection photos missing, RC front copy blurry...'
                }
                className="w-full px-3 py-2 text-xs rounded-lg border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <button
                onClick={() => {
                  setSelectedTask(null);
                  setResolutionAction(null);
                }}
                className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
              >
                Cancel
              </button>
              <button
                disabled={resolveMutation.isPending || (resolutionAction === 'REJECTED' && !notes.trim())}
                onClick={() =>
                  resolveMutation.mutate({
                    id: selectedTask.id,
                    status: resolutionAction,
                    verificationNotes: resolutionAction === 'VERIFIED' ? notes : undefined,
                    rejectedReason: resolutionAction === 'REJECTED' ? notes : undefined,
                  })
                }
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white transition disabled:opacity-50 ${
                  resolutionAction === 'VERIFIED' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {resolveMutation.isPending ? 'Processing...' : resolutionAction === 'VERIFIED' ? 'Confirm Verification' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
