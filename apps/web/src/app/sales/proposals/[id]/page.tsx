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
} from 'lucide-react';
import { useProposalWorkspace } from '../../../../hooks/useProposals';

export default function ProposalWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const proposalId = (params?.id as string) || 'PROP-2026-0091';

  const [checklist, setChecklist] = useState([
    { id: '1', name: 'RC Book Copy (Vehicle Registration)', fulfilled: true },
    { id: '2', name: 'PAN Card Copy (Tax Identity)', fulfilled: true },
    { id: '3', name: 'Aadhaar Card Copy (Address Proof)', fulfilled: true },
    { id: '4', name: 'Previous Year Policy Document', fulfilled: false },
  ]);

  const [underwriterNote, setUnderwriterNote] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { reviewProposal, issuePolicy, isIssuing } = useProposalWorkspace(proposalId);

  const fulfilledCount = checklist.filter((c) => c.fulfilled).length;
  const progressPct = Math.round((fulfilledCount / checklist.length) * 100);

  const isApproved = true; // Underwriting approval state
  const isCustomerAccepted = true; // Customer acceptance state
  const isReadyToIssue = progressPct === 100 && isApproved && isCustomerAccepted;

  return (
    <AppShell>
      {/* 1. Header & Underwriting State Machine Stepper */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-extrabold tracking-tight">Proposal #{proposalId}</h1>
              <StatusBadge status="UNDER_REVIEW" />
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Customer: <strong className="text-foreground">Rahul Patil</strong></span>
              <span>Quote Reference: <strong className="text-primary font-bold">QT-2026-0084 (v3)</strong></span>
              <span>Insurer: <strong className="text-foreground">ICICI Lombard</strong></span>
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

            {/* Strict Validation Issue Policy Button */}
            <button
              disabled={!isReadyToIssue || isIssuing}
              onClick={() => {
                issuePolicy();
                router.push('/policies');
              }}
              className={`flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg transition-colors shadow-sm ${
                isReadyToIssue
                  ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                  : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}
            >
              {!isReadyToIssue && <Lock className="h-3.5 w-3.5 mr-1" />}
              <span>Issue Policy Now</span>
            </button>
          </div>
        </div>

        {/* State Machine Stepper */}
        <div className="grid grid-cols-5 gap-2 text-center pt-2 text-xs border-t">
          {[
            { label: 'Draft', done: true },
            { label: 'Submitted', done: true },
            { label: 'Under Review', done: true, current: true },
            { label: 'Approved', done: false },
            { label: 'Policy Issued', done: false },
          ].map((s, idx) => (
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
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Fulfilling
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
              <div className="font-bold text-emerald-600">Low Risk (14/100)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">IDV Deviation</span>
              <div className="font-bold text-foreground">0% (Exact Match)</div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground uppercase font-bold">Vehicle Age</span>
              <div className="font-bold text-foreground">1 Year (Brand New)</div>
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
            <div>Assigned Renewal Executive: <strong className="text-foreground">Rajesh Sharma</strong></div>
            <div>Renewal Campaign Group: <strong className="text-primary font-bold">VIP Motor Retention 2027</strong></div>
          </div>
        </div>
      </div>

      {/* Embedded PDF Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-bold text-sm">Policy Draft Preview — ICICI Lombard Comprehensive</h3>
              <button onClick={() => setIsPreviewOpen(false)} className="p-1 hover:bg-accent rounded">✕</button>
            </div>
            <div className="h-64 bg-muted/30 border rounded-lg flex items-center justify-center text-xs text-muted-foreground font-mono">
              [Embedded PDF Viewer: Policy Schedule POL-001052.pdf • 100% Zoom]
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
