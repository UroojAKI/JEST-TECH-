'use client';

import React from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Clock,
  PhoneCall,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
  ShieldCheck,
  RefreshCw,
  Target,
  BarChart3,
  UserCheck,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';

interface MotorDashboardWidgetsProps {
  data?: any;
}

export function MotorDashboardWidgets({ data }: MotorDashboardWidgetsProps) {
  const pipelineSteps = [
    { label: 'Lead', count: 18, color: 'bg-blue-500' },
    { label: 'Need Analysis', count: 15, color: 'bg-cyan-500' },
    { label: 'Quotation', count: 12, color: 'bg-amber-500' },
    { label: 'Proposal', count: 8, color: 'bg-indigo-500' },
    { label: 'Negotiation', count: 6, color: 'bg-purple-500' },
    { label: 'Payment', count: 5, color: 'bg-emerald-500' },
    { label: 'Issued', count: 4, color: 'bg-emerald-700' },
  ];

  const renewals = [
    { label: 'Today', count: 6, color: 'bg-rose-500 text-white font-black' },
    { label: 'Next 7 Days', count: 18, color: 'bg-amber-500/10 text-amber-600' },
    { label: 'Next 30 Days', count: 42, color: 'bg-sky-500/10 text-sky-600' },
    { label: 'Overdue', count: 5, color: 'bg-red-500/10 text-red-600' },
    { label: 'Lost', count: 2, color: 'bg-muted/40 text-muted-foreground' },
    { label: 'Completed', count: 15, color: 'bg-emerald-500/10 text-emerald-600' },
  ];

  const todayTasks = [
    { time: '09:30 AM', task: 'Call Rahul Sharma', type: 'Call', status: 'Pending' },
    { time: '10:00 AM', task: 'Generate Quote (Swift VXi)', type: 'Quotation', status: 'Pending' },
    { time: '11:30 AM', task: 'Vehicle Inspection - Creta', type: 'Inspection', status: 'In Progress' },
    { time: '01:00 PM', task: 'Policy Issuance - KA22AB1234', type: 'Issuance', status: 'Ready' },
    { time: '03:00 PM', task: 'Renewal Follow-up (Imran)', type: 'Renewal', status: 'Scheduled' },
    { time: '05:30 PM', task: 'Payment Collection (Suresh)', type: 'Payment', status: 'Scheduled' },
  ];

  const followups = [
    { customer: 'John Doe', status: 'Quotation Sent', action: 'Call Today', phone: '+91 98765 43210' },
    { customer: 'Rahul Sharma', status: 'Waiting Payment', action: 'Collect Payment', phone: '+91 98123 45678' },
    { customer: 'Imran Khan', status: 'Documents Pending', action: 'Upload RC', phone: '+91 99887 76655' },
  ];

  const recentPolicies = [
    {
      no: 'JP202600012',
      customer: 'Rahul Sharma',
      vehicle: 'KA22AB1234 (Creta)',
      premium: '₹18,550',
      status: 'Issued',
      renewalDate: '29-Jul-2027',
      statusBadge: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    },
    {
      no: 'JP202600013',
      customer: 'John Doe',
      vehicle: 'KA05PQ1212 (Swift)',
      premium: '₹22,880',
      status: 'Proposal',
      renewalDate: '--',
      statusBadge: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    },
    {
      no: 'JP202600014',
      customer: 'Suresh Patil',
      vehicle: 'KA22M5678 (City)',
      premium: '₹14,200',
      status: 'Payment Pending',
      renewalDate: '--',
      statusBadge: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
    },
  ];

  const drafts = [
    { customer: 'Rahul Sharma', model: 'Hyundai Creta SX', step: 'Coverage Selection', href: '/sales/quotations' },
    { customer: 'John Doe', model: 'Maruti Suzuki Swift VXi', step: 'Add-on Selection', href: '/sales/quotations' },
  ];

  return (
    <div className="space-y-6">
      {/* Row 1: Real-Time Sales Pipeline & Renewals Queue Widget */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Sales Pipeline */}
        <div className="lg:col-span-7 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Real-Time Sales Pipeline
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Conversion Pipeline Stages
              </h3>
            </div>
            <Link href="/crm/leads" className="text-xs font-bold text-primary hover:underline">
              View All Pipeline →
            </Link>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-1.5 text-center">
              {pipelineSteps.map((s, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="p-2 rounded-xl bg-accent border text-[11px] font-black text-foreground">
                    {s.count}
                  </div>
                  <div className="text-[9px] font-extrabold text-muted-foreground truncate" title={s.label}>
                    {s.label}
                  </div>
                  <div className={`h-1.5 rounded-full ${s.color}`} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Renewals Widget */}
        <div className="lg:col-span-5 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Policy Renewals Command
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Expiring Policy Queue
              </h3>
            </div>
            <Link href="/portal/renewals" className="text-xs font-bold text-primary hover:underline">
              Full Queue →
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {renewals.map((r, idx) => (
              <div key={idx} className={`p-2.5 rounded-xl border text-center ${r.color}`}>
                <div className="text-base font-black">{r.count}</div>
                <div className="text-[10px] font-bold opacity-80 mt-0.5 truncate">{r.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 2: Today's Tasks Timeline & Customer Follow-up List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Today's Tasks Timeline */}
        <div className="lg:col-span-7 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Daily Task Schedule
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Today's Action Timeline
              </h3>
            </div>
            <button
              onClick={() => toast.info('New Task added to schedule')}
              className="text-xs font-bold text-primary hover:underline"
            >
              + Add Task
            </button>
          </div>

          <div className="space-y-2">
            {todayTasks.map((t, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl border bg-accent/30 flex items-center justify-between text-xs font-semibold hover:bg-accent/60 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <span className="font-mono text-[10px] font-black text-primary px-2 py-0.5 rounded-md bg-primary/10">
                    {t.time}
                  </span>
                  <span className="font-extrabold text-foreground">{t.task}</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-card border text-muted-foreground">
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Actionable Customer Follow-up List */}
        <div className="lg:col-span-5 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Customer Follow-ups
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Active Outbound Follow-up List
              </h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {followups.map((f, idx) => (
              <div key={idx} className="p-3 rounded-xl border bg-card flex items-center justify-between gap-2 shadow-2xs">
                <div>
                  <div className="text-xs font-black text-foreground">{f.customer}</div>
                  <div className="text-[10px] text-muted-foreground font-semibold mt-0.5">
                    {f.status} • {f.phone}
                  </div>
                </div>

                <button
                  onClick={() => toast.success(`Initiating action: ${f.action} for ${f.customer}`)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all shadow-2xs shrink-0"
                >
                  {f.action}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Recent Motor Policies & Saved Drafts Recovery */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Recent Policies Table */}
        <div className="lg:col-span-8 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Recent Issued & In-Flight Policies
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Policy Issuance Register
              </h3>
            </div>
            <Link href="/policies" className="text-xs font-bold text-primary hover:underline">
              View All Policies →
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                  <th className="py-2 px-3">Policy No</th>
                  <th className="py-2 px-3">Customer</th>
                  <th className="py-2 px-3">Vehicle Details</th>
                  <th className="py-2 px-3">Premium</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3">Renewal</th>
                </tr>
              </thead>
              <tbody className="divide-y font-semibold">
                {recentPolicies.map((p, idx) => (
                  <tr key={idx} className="hover:bg-muted/10">
                    <td className="py-2.5 px-3 font-mono font-bold text-primary">{p.no}</td>
                    <td className="py-2.5 px-3 font-bold">{p.customer}</td>
                    <td className="py-2.5 px-3 text-muted-foreground">{p.vehicle}</td>
                    <td className="py-2.5 px-3 font-bold">{p.premium}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${p.statusBadge}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-muted-foreground font-mono text-[11px]">{p.renewalDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Draft Recovery Widget */}
        <div className="lg:col-span-4 p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Unfinished Draft Recovery
              </span>
              <h3 className="text-sm font-extrabold text-foreground tracking-tight">
                Saved Motor Wizard Drafts
              </h3>
            </div>
          </div>

          <div className="space-y-2.5">
            {drafts.map((d, idx) => (
              <div key={idx} className="p-3 rounded-xl border bg-accent/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-foreground">{d.customer}</span>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                    {d.step}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground font-semibold">{d.model}</div>

                <Link
                  href={d.href}
                  className="w-full py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground text-xs font-bold transition-all flex items-center justify-center space-x-1.5"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Resume Wizard Draft</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Agent Performance & Conversion Quality Telemetry */}
      <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Monthly Operational Performance Metrics
            </span>
            <h3 className="text-sm font-extrabold text-foreground tracking-tight">
              Agent Target vs Achievement Telemetry
            </h3>
          </div>
        </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent">
              <div className="text-xs font-semibold text-muted-foreground mb-1">My Premium</div>
              <div className="text-xl font-black text-primary">₹{data?.kpi?.myPremium?.toLocaleString('en-IN') || '48,25,000'}</div>
            </div>
            <div className="p-4 rounded-xl border bg-gradient-to-br from-emerald-500/10 to-transparent">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Policies Issued</div>
              <div className="text-xl font-black text-emerald-600">{data?.kpi?.policiesIssued || '1,248'}</div>
            </div>
            <div className="p-4 rounded-xl border bg-gradient-to-br from-amber-500/10 to-transparent">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Conversion Ratio</div>
              <div className="text-xl font-black text-amber-600">{data?.kpi?.conversionRatio || '32.4'}%</div>
            </div>
            <div className="p-4 rounded-xl border bg-gradient-to-br from-sky-500/10 to-transparent">
              <div className="text-xs font-semibold text-muted-foreground mb-1">Active Leads</div>
              <div className="text-xl font-black text-sky-600">{data?.kpi?.myLeads || '42'}</div>
            </div>
          </div>
      </div>
    </div>
  );
}
