'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, TrendingUp, ShieldCheck, Users, FileText, Wallet, AlertCircle, Inbox } from 'lucide-react';

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

  const rows = Array.isArray(widget.data?.rows)
    ? widget.data.rows
    : Array.isArray(widget.data?.items)
    ? widget.data.items
    : [];

  return (
    <div
      className={`${colSpanClass} p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col justify-between space-y-4`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold text-foreground tracking-tight flex items-center space-x-2">
          <span>{widget.title}</span>
        </h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold bg-muted/40 text-muted-foreground">
          {widget.type}
        </span>
      </div>

      {/* KPI Widget */}
      {widget.type === 'KPI' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
            <div className="text-[10px] font-semibold text-muted-foreground">
              Gross Written Premium
            </div>
            <div className="text-lg font-black text-primary mt-1">
              ₹{Number(widget.data?.myPremium || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-[10px] text-emerald-600 font-bold flex items-center mt-1">
              <TrendingUp className="h-3 w-3 mr-0.5" /> Authoritative Data
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
            <div className="text-[10px] font-semibold text-muted-foreground">
              Policies Issued
            </div>
            <div className="text-lg font-black text-emerald-600 mt-1">
              {widget.data?.policiesIssued || 0}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-1">
              Active Portfolio
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
            <div className="text-[10px] font-semibold text-muted-foreground">
              Conversion Ratio
            </div>
            <div className="text-lg font-black text-amber-600 mt-1">
              {widget.data?.conversionRatio || '0'}%
            </div>
            <div className="text-[10px] text-muted-foreground font-medium mt-1">
              Target: 30%
            </div>
          </div>
        </div>
      )}

      {/* TABLE Widget */}
      {widget.type === 'TABLE' && (
        <div className="space-y-2 text-xs">
          {rows.length > 0 ? (
            <>
              <div className="flex justify-between items-center py-1.5 border-b text-[10px] font-bold text-muted-foreground">
                <span>REFERENCE</span>
                <span>ENTITY / DETAILS</span>
                <span>AMOUNT / STATUS</span>
              </div>
              {rows.map((row: any, idx: number) => (
                <div
                  key={row.id || idx}
                  className="flex justify-between items-center py-2 text-foreground font-semibold border-b border-muted/30"
                >
                  <span className="font-mono text-primary text-xs">
                    {row.reference || row.code || row.id}
                  </span>
                  <span className="truncate max-w-[140px]">
                    {row.name || row.title || row.entity || '--'}
                  </span>
                  <span className="font-bold text-xs">
                    {row.amount ? `₹${Number(row.amount).toLocaleString('en-IN')}` : row.status || '--'}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className="py-6 flex flex-col items-center justify-center text-muted-foreground space-y-1">
              <Inbox className="h-6 w-6 stroke-[1.5]" />
              <span className="text-[11px] font-medium">No records available</span>
            </div>
          )}
        </div>
      )}

      {/* CHART Widget */}
      {widget.type === 'CHART' && (
        <div className="h-28 rounded-xl bg-muted/20 border flex items-center justify-center text-xs text-muted-foreground font-semibold">
          {widget.data?.chartTitle || 'Telemetry & Production Analytics'}
        </div>
      )}

      {/* LIST Widget */}
      {widget.type === 'LIST' && (
        <div className="space-y-2 text-xs">
          {rows.length > 0 ? (
            rows.map((item: any, idx: number) => (
              <div key={item.id || idx} className="flex items-center space-x-2 text-foreground">
                <div
                  className={`h-2 w-2 rounded-full ${
                    item.status === 'URGENT'
                      ? 'bg-rose-500'
                      : item.status === 'COMPLETED'
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                  }`}
                />
                <span className="font-semibold truncate">
                  {item.title || item.label || item.text}
                </span>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-muted-foreground text-xs font-medium">
              No pending notifications or items
            </div>
          )}
        </div>
      )}

      {/* METRIC Widget */}
      {widget.type === 'METRIC' && (
        <div className="flex flex-col items-center justify-center p-4 bg-primary/5 rounded-xl border border-primary/10">
          <div className="text-3xl font-black text-primary">
            {widget.data?.value ?? widget.metrics?.value ?? '--'}
          </div>
          <div className="text-xs font-semibold text-muted-foreground mt-1">
            {widget.data?.label ?? widget.metrics?.label ?? widget.title}
          </div>
        </div>
      )}

      {/* TIMELINE Widget */}
      {widget.type === 'TIMELINE' && (
        <div className="space-y-3">
          {rows.length > 0 ? (
            rows.map((event: any, idx: number) => (
              <div key={event.id || idx} className="flex items-start space-x-3">
                <div className="h-2 w-2 mt-1.5 rounded-full bg-primary" />
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">
                    {event.title || event.description}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {event.timestamp || event.time || 'Recent'}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-center text-muted-foreground text-xs font-medium">
              No recent audit activity recorded
            </div>
          )}
        </div>
      )}

      {/* ACTIONS Widget */}
      {widget.type === 'ACTIONS' && (
        <div className="grid grid-cols-2 gap-2">
          {Array.isArray(widget.data?.actions) && widget.data.actions.length > 0 ? (
            widget.data.actions.map((act: any, idx: number) => (
              <Link
                key={idx}
                href={act.href || '#'}
                className="flex items-center justify-center space-x-2 bg-primary text-primary-foreground text-xs font-semibold py-2 px-3 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <span>{act.label}</span>
              </Link>
            ))
          ) : (
            <Link
              href="/crm/leads"
              className="flex items-center justify-center space-x-2 bg-primary text-primary-foreground text-xs font-semibold py-2 px-3 rounded-lg hover:bg-primary/90 transition-colors col-span-2"
            >
              <span>View Lead Management</span>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
