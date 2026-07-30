'use client';

import React from 'react';
import Link from 'next/link';
import { SalesKPIs } from './SalesKPIs';
import { useSalesWorkspace } from '../../../hooks/useSalesWorkspace';
import {
  Users,
  PhoneCall,
  FileSpreadsheet,
  PlusCircle,
  Calculator,
  ShieldCheck,
  TrendingUp,
  ArrowRight,
  Send,
} from 'lucide-react';

export function SalesDashboard() {
  const { dashboard, kpis, pipeline, isDashboardLoading } = useSalesWorkspace();

  if (isDashboardLoading) {
    return (
      <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">
        Loading Sales Workspace & Telemetry...
      </div>
    );
  }

  const leadsList = pipeline?.leads || [];

  return (
    <div className="space-y-6">
      {/* Header Banner & Quick Triggers */}
      <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-primary">
              Sales Operating Workspace • Executive & Manager SOP Command Center
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Sales Command Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Complete the end-to-end sales lifecycle—from assigned leads, quotation preparation, proposal underwriting, payment collection, policy issuance to referral capture.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/crm/leads"
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
            >
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Capture New Lead</span>
            </Link>
            <Link
              href="/sales/quotations"
              className="px-3.5 py-2 rounded-xl border bg-card text-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-accent transition-all"
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>Motor Calculator</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Top & Bottom Row Sales KPIs */}
      <SalesKPIs data={kpis} />

      {/* Pipeline Funnel & Assigned Leads Table */}
      <div className="p-5 rounded-2xl border bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
              Assigned Pipeline & SOP Stages
            </span>
            <h3 className="text-sm font-extrabold text-foreground">Active Sales Leads</h3>
          </div>
          <Link
            href="/crm/leads"
            className="text-xs font-bold text-primary hover:underline flex items-center space-x-1"
          >
            <span>View All Leads</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                <th className="py-2.5 px-3">Lead Code</th>
                <th className="py-2.5 px-3">Customer Name</th>
                <th className="py-2.5 px-3">Product Interest</th>
                <th className="py-2.5 px-3">Workflow Step</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y text-xs font-semibold">
              {leadsList.slice(0, 8).map((l: any) => (
                <tr key={l.id} className="hover:bg-muted/10 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-primary font-bold">{l.leadCode}</td>
                  <td className="py-2.5 px-3 text-foreground font-bold">
                    {l.contact ? `${l.contact.firstName} ${l.contact.lastName}` : l.title}
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{l.title}</td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      {l.currentWorkflowStep || 'ASSIGNED'}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/30 text-muted-foreground">
                      {l.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link
                      href={`/workspace/sales/leads/${l.id}`}
                      className="px-2.5 py-1 rounded-lg bg-accent text-foreground text-[11px] font-bold hover:bg-primary hover:text-primary-foreground transition-all"
                    >
                      Open Lead Workspace
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
