'use client';
import React from 'react';
import { Target, Users, Calendar, Clock, CheckCircle } from 'lucide-react';

export default function SalesManagerDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Target vs Achievement */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">MTD Achievement</span>
            <Target className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-primary">82%</div>
          <div className="text-xs text-muted-foreground mt-1">Target: ₹2.5 Cr</div>
        </div>

        {/* Conversion Rate */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Conversion Rate</span>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-emerald-500">28.4%</div>
          <div className="text-xs text-emerald-600 font-bold mt-1">+2.1% vs last week</div>
        </div>

        {/* Pending Proposals */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Pending Proposals</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-amber-500">142</div>
          <div className="text-xs text-muted-foreground mt-1">Value: ₹1.8 Cr</div>
        </div>

        {/* Today's Follow-ups */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Today's Follow-ups</span>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">45</div>
          <div className="text-xs text-rose-500 font-bold mt-1">12 High Priority</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by Stage */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4">Pipeline by Stage</h3>
          <div className="space-y-4">
            {[
              { stage: 'Initial Contact', count: 280, color: 'bg-slate-200 dark:bg-slate-700', width: '100%' },
              { stage: 'Requirement Gathering', count: 195, color: 'bg-blue-300 dark:bg-blue-700', width: '70%' },
              { stage: 'Quotation Shared', count: 142, color: 'bg-indigo-400 dark:bg-indigo-600', width: '50%' },
              { stage: 'Negotiation', count: 85, color: 'bg-purple-500', width: '30%' },
              { stage: 'Closed Won', count: 48, color: 'bg-emerald-500', width: '15%' },
            ].map((stage, i) => (
              <div key={i} className="relative pt-1">
                <div className="flex mb-2 items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold inline-block">{stage.stage}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold inline-block text-primary">{stage.count}</span>
                  </div>
                </div>
                <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-muted">
                  <div style={{ width: stage.width }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${stage.color}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Agents */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Top Performing Agents
          </h3>
          <div className="space-y-3">
            {[
              { name: 'Rahul Sharma', premium: '₹45.2 L', policies: 32 },
              { name: 'Priya Patel', premium: '₹38.5 L', policies: 28 },
              { name: 'Amit Kumar', premium: '₹31.0 L', policies: 21 },
              { name: 'Neha Gupta', premium: '₹28.4 L', policies: 19 },
            ].map((agent, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                    {agent.name.charAt(0)}
                  </div>
                  <span className="text-sm font-semibold">{agent.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{agent.premium}</div>
                  <div className="text-[10px] text-muted-foreground">{agent.policies} policies</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
