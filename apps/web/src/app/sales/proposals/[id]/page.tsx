'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { StatusBadge } from '../../../../components/ui/status-badge';
import {
  ShieldCheck,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  FileText,
  Lock,
  ArrowRight,
  Eye,
  Calendar,
  Loader2,
} from 'lucide-react';
import { useProposalWorkspace } from '../../../../hooks/useProposals';
import { formatCurrency } from '../../../../lib/formatters';
import { toast } from 'sonner';

export default function ProposalWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = (params?.id as string) || '';

  const [checklist, setChecklist] = useState([
    { id: '1', name: 'RC Book Copy (Vehicle Registration)', fulfilled: true },
    { id: '2', name: 'PAN Card Copy (Tax Identity)', fulfilled: true },
    { id: '3', name: 'Aadhaar Card Copy (Address Proof)', fulfilled: true },
    { id: '4', name: 'Previous Year Policy Document', fulfilled: true },
  ]);

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { proposal, isLoading, isError, issuePolicy, isIssuing } = useProposalWorkspace(proposalId);

  const fulfilledCount = checklist.filter((c) => c.fulfilled).length;
  const progressPct = Math.round((fulfilledCount / checklist.length) * 100);

  const isApproved = proposal ? proposal.status === 'APPROVED' || proposal.status === 'POLICY_ISSUED' : true;
  const isReadyToIssue = progressPct === 100 && isApproved;

  const handleIssuePolicyClick = async () => {
    try {
      await issuePolicy();
      toast.success(`Policy issued successfully for Proposal #${proposalId}!`);
      router.push('/policies');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to issue policy');
    }
  };

  return (
    <AppShell>
      {/* 1. Header & Underwriting State Machine Stepper */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-extrabold tracking-tight">Proposal #{proposalId}</h1>
              <StatusBadge status={proposal?.status || 'UNDER_REVIEW'} />
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Customer: <strong className="text-foreground">{proposal?.contactName || 'Client Prospect'}</strong></span>
              <span>Quote Reference: <strong className="text-primary font-bold">{proposal?.quotationId || 'QT-2026-0084'}</strong></span>
              <span>Product: <strong className="text-foreground">{proposal?.productLine || 'Motor Comprehensive'}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
            >
              <Eye className="h-4 w-4" />
              <span>Preview Policy PDF</span>
            </button>

            {/* Issue Policy Button */}
            <button
              disabled={!isReadyToIssue || isIssuing}
              onClick={handleIssuePolicyClick}
              className={`flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                isReadyToIssue
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {isIssuing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : !isReadyToIssue ? (
                <Lock className="h-3.5 w-3.5 mr-1" />
              ) : null}
              <span>{isIssuing ? 'Issuing Policy...' : 'Issue Policy Now'}</span>
            </button>
          </div>
        </div>

        {/* State Machine Stepper */}
        <div className="grid grid-cols-5 gap-2 text-center pt-2 text-xs border-t">
          {[
            { label: 'Draft', done: true },
            { label: 'Submitted', done: true },
            { label: 'Under Review', done: proposal?.status !== 'DRAFT', current: proposal?.status === 'UNDER_REVIEW' },
            { label: 'Approved', done: proposal?.status === 'APPROVED' || proposal?.status === 'POLICY_ISSUED' },
            { label: 'Policy Issued', done: proposal?.status === 'POLICY_ISSUED' },
          ].map((s) => (
            <div
              key={s.label}
              className={`p-2 rounded-lg border flex flex-col items-center space-y-0.5 ${
                s.current
                  ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                  : s.done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold'
                  : 'bg-muted/20 text-muted-foreground'
              }`}
            >
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Mandatory Document Checklist Progress */}
      <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center space-x-2">
            <FileCheck className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Mandatory Document Checklist</h3>
          </div>
          <span className="text-xs font-bold text-primary">{progressPct}% Complete ({fulfilledCount}/{checklist.length})</span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${progressPct === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
          {checklist.map((item) => (
            <div key={item.id} className="p-2.5 rounded-lg border bg-muted/10 flex justify-between items-center">
              <span className="font-semibold">{item.name}</span>
              {item.fulfilled ? (
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 font-bold flex items-center">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Fulfilled
                </span>
              ) : (
                <button
                  onClick={() => {
                    setChecklist(
                      checklist.map((c) => (c.id === item.id ? { ...c, fulfilled: true } : c))
                    );
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-primary text-primary-foreground font-bold hover:bg-primary/90"
                >
                  + Fulfill Document
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 3. Underwriting Risk Indicators & Renewal Metadata */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Risk Assessment */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2">Underwriting Risk Indicators</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Overall Risk Score</span>
              <div className="font-bold text-emerald-600">{proposal?.riskScore || 14}/100 (Low Risk)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Annual Premium</span>
              <div className="font-bold text-emerald-600" suppressHydrationWarning>{formatCurrency(proposal?.totalPremium || 25000)}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Document Attachments</span>
              <div className="font-bold text-foreground">{proposal?.documentsCount || 4} Uploaded</div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Claim History</span>
              <div className="font-bold text-emerald-600">0 Claims (NCB 25%)</div>
            </div>
          </div>
        </div>

        {/* Renewal Readiness Metadata */}
        <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary" /> Renewal Readiness Engine
          </h3>
          <div className="space-y-2 text-xs">
            <div>Expected Next Renewal Date: <strong className="text-foreground">2027-07-22</strong></div>
            <div>Assigned Renewal Executive: <strong className="text-foreground">Assigned Executive</strong></div>
            <div>Renewal Campaign Group: <strong className="text-primary font-bold">VIP Retention 2027</strong></div>
          </div>
        </div>
      </div>

      {/* Embedded PDF Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm">Policy Draft Preview — {proposal?.productLine || 'Comprehensive Policy'}</h3>
              <button onClick={() => setIsPreviewOpen(false)} className="p-1 hover:bg-accent rounded text-muted-foreground">✕</button>
            </div>
            <div className="h-64 bg-muted/30 border rounded-lg flex items-center justify-center text-xs text-muted-foreground font-mono">
              [Embedded PDF Viewer: Policy Schedule {proposal?.proposalNumber || proposalId}.pdf • 100% Zoom]
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
