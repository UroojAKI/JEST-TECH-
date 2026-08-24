'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { StatusBadge } from '../../../components/ui/status-badge';
import {
  ShieldCheck,
  RefreshCw,
  FileText,
  Clock,
  HeartPulse,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Plus,
  Folder,
} from 'lucide-react';
import { RenewalWizardDrawer } from '../../../components/policies/drawers/RenewalWizardDrawer';
import { EndorsementRequestDrawer } from '../../../components/policies/drawers/EndorsementRequestDrawer';

export default function PolicyWorkspacePage() {
  const params = useParams();
  const policyId = (params?.id as string) || 'POL-001048';

  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [isEndorsementOpen, setIsEndorsementOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');

  return (
    <AppShell>
      {/* 1. Header & Policy Lifecycle Stepper */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-extrabold tracking-tight">Policy #{policyId}</h1>
              <StatusBadge status="RENEWAL_DUE" />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                MOTOR COMPREHENSIVE
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Customer: <strong className="text-foreground">Rahul Patil</strong></span>
              <span>Insurer: <strong className="text-foreground">ICICI Lombard</strong></span>
              <span>Vehicle: <strong className="text-foreground">MH-12-AB-1234</strong></span>
              <span>Renewal Executive: <strong className="text-foreground">Assigned Executive</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEndorsementOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>+ Endorsement</span>
            </button>
            <button
              onClick={() => setIsRenewalOpen(true)}
              className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Launch Renewal Wizard →</span>
            </button>
          </div>
        </div>

        {/* Lifecycle Stepper */}
        <div className="grid grid-cols-7 gap-2 text-center pt-2 text-xs border-t">
          {[
            { label: 'Issued', done: true },
            { label: 'Active', done: true },
            { label: 'Endorsement', done: true },
            { label: 'Renewal Window', done: true, current: true },
            { label: 'Grace Period', done: false },
            { label: 'Expired', done: false },
            { label: 'Archived', done: false },
          ].map((stage) => (
            <div
              key={stage.label}
              className={`p-2 rounded-lg border flex flex-col items-center space-y-0.5 ${
                stage.current
                  ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                  : stage.done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold'
                  : 'bg-muted/20 text-muted-foreground'
              }`}
            >
              <span className="text-[10px]">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Policy Health & Financial Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Policy Health Gauge */}
        <div className="lg:col-span-4 rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center space-x-2">
              <HeartPulse className="h-4 w-4 text-emerald-500" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Policy Health Gauge</h3>
            </div>
            <span className="text-xs font-black text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
              92 / 100 • Excellent
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground">Renewal Probability</span>
              <div className="font-bold text-foreground">89%</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground">Claims Frequency</span>
              <div className="font-bold text-emerald-600">0 Claims</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground">Outstanding Balance</span>
              <div className="font-bold text-foreground">₹0 (Paid)</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground">Document Vault</span>
              <div className="font-bold text-emerald-600">100% Complete</div>
            </div>
          </div>
        </div>

        {/* Hero Renewal Center Cockpit */}
        <div className="lg:col-span-8 rounded-2xl border bg-card p-4 shadow-sm space-y-2">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center space-x-2">
              <Clock className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Renewal Center & Campaign Cockpit</h3>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              24 Days Remaining
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2 text-center text-xs py-2">
            {[
              { stage: '45 Days', done: true },
              { stage: '30 Days', done: true },
              { stage: '15 Days', done: false, active: true },
              { stage: '7 Days', done: false },
              { stage: 'Grace', done: false },
              { stage: 'Expired', done: false },
            ].map((s) => (
              <div
                key={s.stage}
                className={`p-2 rounded-lg border text-[10px] font-bold ${
                  s.active
                    ? 'bg-amber-500 text-white shadow'
                    : s.done
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                    : 'bg-muted/20 text-muted-foreground'
                }`}
              >
                {s.stage}
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground flex justify-between items-center pt-1 border-t">
            <span>Campaign Group: <strong>VIP Motor Retention 2026</strong></span>
            <span>Last Contact: <strong>2026-07-20 (WhatsApp Dispatched)</strong></span>
          </div>
        </div>
      </div>

      {/* 3. Workspace Tabs Container */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'ENDORSEMENTS', label: 'Endorsements', badge: 1 },
            { id: 'CLAIMS', label: 'Claims History', badge: 0 },
            { id: 'DOCUMENTS', label: 'Foldered Documents', badge: 4 },
            { id: 'PAYMENTS', label: 'Payments Ledger' },
            { id: 'TIMELINE', label: 'Operational Timeline' },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-background shadow text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <span>{t.label}</span>
              {t.badge !== undefined && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 text-xs space-y-4">
          {activeTab === 'ENDORSEMENTS' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Active Servicing & Endorsement Requests</h4>
                <button
                  onClick={() => setIsEndorsementOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs"
                >
                  + Request Endorsement
                </button>
              </div>

              <div className="p-4 rounded-xl border bg-card space-y-2">
                <div className="flex justify-between items-center">
                  <div className="font-bold text-sm">ADDRESS_CHANGE (Non-Financial)</div>
                  <StatusBadge status="APPROVED" />
                </div>
                <p className="text-muted-foreground text-xs">Updated address to BKC, Mumbai 400051.</p>
              </div>
            </div>
          )}

          {activeTab === 'DOCUMENTS' && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {['Policy Schedule', 'Proposal Form', 'Receipts & Tax', 'KYC & RC Copies'].map((folder) => (
                <div key={folder} className="p-4 rounded-xl border bg-card hover:border-primary cursor-pointer transition-colors flex items-center space-x-3">
                  <Folder className="h-6 w-6 text-primary" />
                  <div>
                    <div className="font-bold text-xs">{folder}</div>
                    <span className="text-[10px] text-muted-foreground">1 File</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {['OVERVIEW', 'CLAIMS', 'PAYMENTS', 'TIMELINE'].includes(activeTab) && (
            <div className="py-8 text-center text-muted-foreground">
              Active Policy Workspace Module: <strong>{activeTab}</strong> for Policy {policyId}.
            </div>
          )}
        </div>
      </div>

      {/* Drawers */}
      <RenewalWizardDrawer
        isOpen={isRenewalOpen}
        policyId={policyId}
        onClose={() => setIsRenewalOpen(false)}
      />

      <EndorsementRequestDrawer
        isOpen={isEndorsementOpen}
        policyId={policyId}
        onClose={() => setIsEndorsementOpen(false)}
      />
    </AppShell>
  );
}
