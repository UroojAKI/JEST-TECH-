'use client';
import React from 'react';
import { Target, Users, Calendar, Clock, CheckCircle, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';

export default function SalesManagerDashboard() {
  const { data: dashboard, isLoading: isDashboardLoading } = useQuery({
    queryKey: ['sales-manager-dashboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/workspace/sales/dashboard');
        return res.data;
      } catch {
        return null;
      }
    },
  });

  const { data: leaderboard = [], isLoading: isLeaderboardLoading } = useQuery({
    queryKey: ['sales-leaderboard'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/dashboard/management/leaderboard');
        return Array.isArray(res.data) ? res.data : [];
      } catch {
        return [];
      }
    },
  });

  const kpis = dashboard?.kpis?.topRow || {
    assignedLeads: 0,
    interestedLeads: 0,
    todayCalls: 0,
    todayMeetings: 0,
    quotePending: 0,
    proposalPending: 0,
    policiesSold: 0,
    todayRevenue: 0,
  };

  const distribution = dashboard?.pipeline?.distribution || {};
  const pipelineStages = [
    { stage: 'Assigned Leads', count: distribution.ASSIGNED || 0, color: 'bg-slate-400', width: '20%' },
    { stage: 'Contacted', count: distribution.CONTACTED || 0, color: 'bg-blue-400', width: '40%' },
    { stage: 'Quotation Shared', count: distribution.QUOTATION || 0, color: 'bg-indigo-500', width: '60%' },
    { stage: 'Negotiation', count: distribution.NEGOTIATION || 0, color: 'bg-purple-500', width: '80%' },
    { stage: 'Issued / Closed', count: distribution.ISSUED || 0, color: 'bg-emerald-500', width: '100%' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today Revenue */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Today's Premium</span>
            <Target className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-primary">₹{(kpis.todayRevenue || 0).toLocaleString('en-IN')}</div>
          <div className="text-xs text-muted-foreground mt-1">Live GWP Today</div>
        </div>

        {/* Policies Sold */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Policies Issued</span>
            <CheckCircle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-emerald-500">{kpis.policiesSold || 0}</div>
          <div className="text-xs text-emerald-600 font-bold mt-1">Authoritative Issued Count</div>
        </div>

        {/* Pending Proposals */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Pending Proposals</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-amber-500">{kpis.proposalPending || 0}</div>
          <div className="text-xs text-muted-foreground mt-1">Awaiting Underwriting / Payment</div>
        </div>

        {/* Today's Follow-ups */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground mb-2">
            <span className="text-xs font-semibold">Today's Customer Calls</span>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">{kpis.todayCalls || 0}</div>
          <div className="text-xs text-primary font-bold mt-1">Logged Call Activities</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline by Stage */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4">Pipeline by Stage</h3>
          <div className="space-y-4">
            {pipelineStages.map((stage, i) => (
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
                  <div style={{ width: stage.count > 0 ? stage.width : '0%' }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${stage.color}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performing Agents */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <Users className="w-4 h-4" /> Active Sales Agent Leaderboard
          </h3>
          {isLeaderboardLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-xs gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading leaderboard...
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground border rounded-xl bg-accent/20">
              No sales performance records found in database.
            </div>
          ) : (
            <div className="space-y-3">
              {leaderboard.map((agent: any, i: number) => (
                <div key={agent.agentId || i} className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                      {(agent.agentName || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-semibold">{agent.agentName}</span>
                      <div className="text-[10px] text-muted-foreground">{agent.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{agent.formattedGwp || `₹${(agent.gwp || 0).toLocaleString('en-IN')}`}</div>
                    <div className="text-[10px] text-muted-foreground">{agent.policiesIssued || 0} policies issued</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
