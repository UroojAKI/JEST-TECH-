'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp, ShieldCheck, Users, FileText, Wallet, AlertCircle } from 'lucide-react';

interface WidgetProps {
  widget: {
    id: string;
    type: string;
    title: string;
    colSpan?: number;
    metrics?: any;
    data?: any;
  };
}

export function WidgetRenderer({ widget }: WidgetProps) {
  const colSpanClass =
    widget.colSpan === 12
      ? 'col-span-12'
      : widget.colSpan === 8
      ? 'col-span-12 lg:col-span-8'
      : widget.colSpan === 6
      ? 'col-span-12 md:col-span-6'
      : 'col-span-12 lg:col-span-4';

  return (
    <div className={`${colSpanClass} p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col justify-between space-y-4`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-foreground tracking-tight flex items-center space-x-2">
          <span>{widget.title}</span>
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-muted/40 text-muted-foreground">
          {widget.type}
        </span>
      </div>

      {/* Widget Dynamic Content Rendering */}
      {widget.type === 'KPI' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="text-[10px] font-semibold text-muted-foreground">Gross Written Premium</div>
            <div className="text-lg font-black text-primary mt-1">₹{widget.data?.myPremium?.toLocaleString('en-IN') || '0'}</div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-0.5" /> Dynamic Data
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="text-[10px] font-semibold text-muted-foreground">Policies Issued</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{widget.data?.policiesIssued || 0}</div>
            <div className="text-[10px] text-muted-foreground font-medium mt-1">Motor & Health</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <div className="text-[10px] font-semibold text-muted-foreground">Conversion Ratio</div>
            <div className="text-lg font-black text-amber-600 mt-1">{widget.data?.conversionRatio || '0'}%</div>
            <div className="text-[10px] text-amber-600 font-bold mt-1">Target: 30%</div>
          </div>
        </div>
      )}

      {widget.type === 'TABLE' && (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1.5 border-b text-[10px] font-bold text-muted-foreground">
            <span>REFERENCE</span>
            <span>CUSTOMER / ENTITY</span>
            <span>AMOUNT</span>
          </div>
          <div className="flex justify-between items-center py-2 text-foreground font-semibold border-b border-muted/30">
            <span className="font-mono text-primary">POL-2026-8841</span>
            <span>Ramesh Motors Pvt Ltd</span>
            <span className="font-bold">₹1,45,000</span>
          </div>
          <div className="flex justify-between items-center py-2 text-foreground font-semibold border-b border-muted/30">
            <span className="font-mono text-primary">CLM-2026-3391</span>
            <span>Suresh Kumar</span>
            <span className="font-bold text-rose-500">₹85,000</span>
          </div>
        </div>
      )}

      {widget.type === 'CHART' && (
        <div className="h-28 rounded-xl bg-muted/20 border flex items-center justify-center text-xs text-muted-foreground font-semibold">
          [ Interactive Telemetry & Regional Analytics Graph ]
        </div>
      )}

      {widget.type === 'LIST' && (
        <div className="space-y-2 text-xs">
          <div className="flex items-center space-x-2 text-foreground">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="font-semibold">Follow-up with Ankit Shah (Health Renewal)</span>
          </div>
          <div className="flex items-center space-x-2 text-foreground">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="font-semibold">Corporate Fleet Quote Approval</span>
          </div>
        </div>
      )}
      {widget.type === 'METRIC' && (
        <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/10">
          <div className="text-3xl font-black text-primary">85%</div>
          <div className="text-xs font-semibold text-muted-foreground mt-1">Target Achievement</div>
        </div>
      )}

      {widget.type === 'TIMELINE' && (
        <div className="space-y-3">
          <div className="flex items-start space-x-3">
            <div className="h-2 w-2 mt-1.5 rounded-full bg-primary" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold">User logged in</span>
              <span className="text-[10px] text-muted-foreground">2 mins ago</span>
            </div>
          </div>
          <div className="flex items-start space-x-3">
            <div className="h-2 w-2 mt-1.5 rounded-full bg-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Policy issued</span>
              <span className="text-[10px] text-muted-foreground">1 hour ago</span>
            </div>
          </div>
        </div>
      )}

      {widget.type === 'ACTIONS' && (
        <div className="grid grid-cols-2 gap-2">
          <button className="flex items-center justify-center space-x-2 bg-primary text-primary-foreground text-xs font-semibold py-2 px-3 rounded-lg hover:bg-primary/90 transition-colors">
            <span>Action 1</span>
          </button>
          <button className="flex items-center justify-center space-x-2 bg-muted text-foreground text-xs font-semibold py-2 px-3 rounded-lg hover:bg-muted/80 transition-colors">
            <span>Action 2</span>
          </button>
        </div>
      )}
    </div>
  );
}
