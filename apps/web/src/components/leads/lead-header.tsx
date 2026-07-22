'use client';

import React from 'react';
import {
  User,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Flame,
  Globe,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { StatusBadge } from '../ui/status-badge';

interface LeadHeaderProps {
  lead: any;
  onLaunchConvert: () => void;
  onLaunchMarkLost: () => void;
}

export function LeadHeader({ lead, onLaunchConvert, onLaunchMarkLost }: LeadHeaderProps) {
  const isDuplicate = lead?.duplicateWarning ?? true;

  return (
    <div className="space-y-4">
      {/* Duplicate Warning Banner */}
      {isDuplicate && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>
              <strong>Duplicate Lead Warning:</strong> A matching lead (LD-00841 for Rahul Patil) was created 3 days ago.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-2.5 py-1 rounded bg-amber-500 text-white font-bold text-[10px]">
              View Existing
            </button>
            <button className="px-2.5 py-1 rounded border border-amber-500/40 font-semibold text-[10px]">
              Merge Leads
            </button>
          </div>
        </div>
      )}

      {/* Header Container */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-600 font-black text-xl flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <Flame className="h-7 w-7 text-amber-500" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-extrabold tracking-tight">{lead?.name || 'Rahul Patil'}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  HOT LEAD
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  MOTOR COMPREHENSIVE
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  WEBSITE SOURCE
                </span>
              </div>

              <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                <span>Code: <strong className="text-foreground">{lead?.code || 'LD-00912'}</strong></span>
                <span>Expected GWP: <strong className="text-emerald-600">₹18,450</strong></span>
                <span>Lead Score: <strong className="text-primary font-bold">84 / 100</strong></span>
                <span>Assigned Agent: <strong className="text-foreground">{lead?.agent || 'Rajesh Sharma'}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={onLaunchConvert}
              className="px-3.5 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Convert Lead →
            </button>
            <button
              onClick={onLaunchMarkLost}
              className="px-3 py-2 text-xs font-semibold rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              Mark Lost
            </button>
          </div>
        </div>

        {/* SLA Panel & Quick Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">SLA Response Status</span>
            <div className="flex items-center space-x-1 text-emerald-600 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>🟢 On Track (1h 45m left)</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Current Stage</span>
            <div className="font-bold text-foreground">QUOTE PREPARED</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Next Action</span>
            <div className="font-bold text-primary">Call client for terms</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Days in Pipeline</span>
            <div className="font-bold text-foreground">4 Days</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Pending Docs</span>
            <div className="font-bold text-amber-600">RC Copy Required</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Expected Close</span>
            <div className="font-bold text-foreground">2026-07-28</div>
          </div>
        </div>
      </div>
    </div>
  );
}
