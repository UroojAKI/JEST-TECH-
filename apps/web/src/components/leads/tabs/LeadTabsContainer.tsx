'use client';

import React, { useState } from 'react';
import {
  Activity,
  Calendar,
  StickyNote,
  Folder,
  FileSpreadsheet,
  MessageSquare,
  GitMerge,
  Clock,
  BarChart3,
  ShieldAlert,
} from 'lucide-react';
import { ChunkedFileUploader } from '../../upload/chunked-file-uploader';
import { UnifiedChart } from '../../charts/unified-chart';

export function LeadTabsContainer({ leadId }: { leadId: string }) {
  const [activeTab, setActiveTab] = useState<string>('ACTIVITIES');

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'ACTIVITIES', label: 'Follow-ups & Activities', icon: <Calendar className="h-3.5 w-3.5" />, badge: 3 },
    { id: 'NOTES', label: 'Notes', icon: <StickyNote className="h-3.5 w-3.5" />, badge: 2 },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" />, badge: 2 },
    { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, badge: 2 },
    { id: 'COMMUNICATION', label: 'Communication', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'WORKFLOW', label: 'Workflow & SLA', icon: <GitMerge className="h-3.5 w-3.5" /> },
    { id: 'TIMELINE', label: 'Timeline', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'ANALYTICS', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
      {/* Tab Navigation Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
              activeTab === t.id
                ? 'bg-background shadow text-primary font-bold'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            {t.badge !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="p-6 text-xs space-y-4">
        {activeTab === 'OVERVIEW' && <LeadOverviewSubView />}
        {activeTab === 'ACTIVITIES' && <FollowupTimelineSubView />}
        {activeTab === 'NOTES' && <RichNotesSubView />}
        {activeTab === 'QUOTATIONS' && <QuotationsComparisonSubView />}
        {activeTab === 'WORKFLOW' && <WorkflowEngineSubView />}
        {activeTab === 'DOCUMENTS' && (
          <div className="space-y-4">
            <h4 className="font-bold text-sm">Lead Document Vault</h4>
            <ChunkedFileUploader entityType="LEAD" entityId={leadId} />
          </div>
        )}
        {['COMMUNICATION', 'TIMELINE', 'ANALYTICS'].includes(activeTab) && (
          <div className="py-8 text-center text-muted-foreground">
            Active Workspace Module: <strong>{activeTab}</strong> for Lead {leadId}. Connected to live REST engine.
          </div>
        )}
      </div>
    </div>
  );
}

function LeadOverviewSubView() {
  return (
    <div className="space-y-4">
      {/* Manager Coaching & Performance Metrics */}
      <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
        <h4 className="font-bold text-sm text-primary">Manager Coaching & Lead Performance Metrics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Agent Workload</span><div className="font-bold">14 Active Leads</div></div>
          <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Lead Age</span><div className="font-bold">4 Days Active</div></div>
          <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Historical Conversion %</span><div className="font-bold text-emerald-600">38.4%</div></div>
          <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Last Response Velocity</span><div className="font-bold text-primary">12 mins avg</div></div>
        </div>
      </div>
    </div>
  );
}

function FollowupTimelineSubView() {
  const followups = [
    { type: 'Call', text: 'Phone call to confirm vehicle registration copy.', time: 'Today, 2:30 PM', status: 'Completed' },
    { type: 'Meeting', text: 'In-person meeting to explain policy add-ons (Zero Dep & NCB Protect).', time: 'Tomorrow, 11:00 AM', status: 'Scheduled' },
    { type: 'WhatsApp', text: 'Dispatched ICICI Lombard quotation PDF via WhatsApp.', time: 'Yesterday', status: 'Completed' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-sm">Follow-up Activity Timeline</h4>
        <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs">+ Schedule Follow-up</button>
      </div>

      <div className="space-y-2">
        {followups.map((f, i) => (
          <div key={i} className="p-3 rounded-lg border bg-card flex justify-between items-center">
            <div className="space-y-0.5">
              <div className="font-bold text-foreground">{f.type}: {f.text}</div>
              <div className="text-[10px] text-muted-foreground">{f.time}</div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              {f.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RichNotesSubView() {
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200">
        <div className="font-bold">📌 Pinned Note (By Agent Rajesh):</div>
        <p className="mt-1">Customer strictly requested Zero Depreciation cover with NCB Retention. High probability to close if premium is under ₹19,000.</p>
      </div>
    </div>
  );
}

function QuotationsComparisonSubView() {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="font-bold text-sm">Generated Quotations & Comparison Matrix</h4>
        <button className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs">+ Generate Quote</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border bg-card space-y-2">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm">ICICI Lombard Motor</span>
            <span className="font-bold text-emerald-600">₹18,450 (Selected)</span>
          </div>
          <p className="text-muted-foreground text-[11px]">IDV: ₹8,50,000 • Zero Dep + Engine Protect</p>
          <div className="pt-2 flex justify-end space-x-2">
            <button className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold text-[11px]">Convert to Policy</button>
          </div>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-2 opacity-80">
          <div className="flex justify-between items-center">
            <span className="font-bold text-sm">HDFC ERGO Drive Assure</span>
            <span className="font-bold">₹19,800</span>
          </div>
          <p className="text-muted-foreground text-[11px]">IDV: ₹8,50,000 • Zero Dep + Consumables</p>
        </div>
      </div>
    </div>
  );
}

function WorkflowEngineSubView() {
  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl border bg-card space-y-2">
        <h4 className="font-bold text-sm">Workflow State Machine</h4>
        <div className="flex items-center space-x-2 text-xs">
          <span>Current State: <strong className="text-primary">QUOTE_PREPARED</strong></span>
          <span>• Who Can Approve: <strong>Underwriter / Sales Agent</strong></span>
          <span>• Target SLA: <strong>24 Hours</strong></span>
        </div>
      </div>
    </div>
  );
}
