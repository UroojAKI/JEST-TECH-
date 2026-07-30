'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import {
  RefreshCw,
  PhoneCall,
  MessageSquare,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  XCircle,
  Star,
  Search,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

export default function RenewalManagementPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'DUE_TODAY' | '7_DAYS' | '15_DAYS' | '30_DAYS' | 'OVERDUE' | 'RENEWED'>('DUE_TODAY');
  const [search, setSearch] = useState('');
  const [selectedLostTask, setSelectedLostTask] = useState<any>(null);
  const [lostReason, setLostReason] = useState('Lost To Competitor');
  const [competitorName, setCompetitorName] = useState('');

  // Queries
  const { data: kpis } = useQuery({
    queryKey: ['renewal-kpis'],
    queryFn: async () => {
      const res = await apiClient.get('/policies/renewals/kpis');
      return res.data;
    },
  });

  const { data: upcomingTasks = [], isLoading } = useQuery({
    queryKey: ['renewal-upcoming-tasks'],
    queryFn: async () => {
      const res = await apiClient.get('/policies/renewals/upcoming');
      return res.data || [];
    },
  });

  // Lost Reason Mutation
  const markLostMutation = useMutation({
    mutationFn: async ({ taskId, reason, competitorName }: any) => {
      const res = await apiClient.post(`/policies/renewals/${taskId}/lost`, { reason, competitorName });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['renewal-upcoming-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['renewal-kpis'] });
      toast.success('Renewal marked as Lost with reason captured.');
      setSelectedLostTask(null);
    },
  });

  const handleMarkLostSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLostTask) return;
    markLostMutation.mutate({
      taskId: selectedLostTask.id,
      reason: lostReason,
      competitorName,
    });
  };

  const sampleRenewals = [
    { id: 'ren-1', vehicleReg: 'KA22-AB-1234', customerName: 'John Doe', phone: '+91 98765 43210', policyNo: 'POL-998124', insurer: 'HDFC ERGO', premium: '₹18,500', expiry: 'Today', priority: 'HIGH', retentionScore: 5 },
    { id: 'ren-2', vehicleReg: 'KA05-XY-9988', customerName: 'Rahul Singh', phone: '+91 98123 45678', policyNo: 'POL-771239', insurer: 'ICICI Lombard', premium: '₹22,400', expiry: 'In 7 Days', priority: 'MEDIUM', retentionScore: 4 },
    { id: 'ren-3', vehicleReg: 'KA19-PQ-5521', customerName: 'ABC Logistics', phone: '+91 97711 22334', policyNo: 'POL-661122', insurer: 'Bajaj Allianz', premium: '₹45,000', expiry: 'In 30 Days', priority: 'LOW', retentionScore: 3 },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Customer Retention Operating System • 100% Policy Renewal Coverage
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Renewal & Retention Management Workspace
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Automated 365-day renewal scheduling, agent work queues, pre-filled renewal quotes, lost renewal analytics, and customer retention scoring.
            </p>
          </div>
        </div>

        {/* Renewal KPI Telemetry */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Due Today</div>
            <div className="text-lg font-black text-rose-600 mt-1">{kpis?.dueToday || 5}</div>
            <div className="text-[9px] text-rose-600 font-bold">Action Required</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">In 7 Days</div>
            <div className="text-lg font-black text-amber-600 mt-1">{kpis?.in7Days || 12}</div>
            <div className="text-[9px] text-muted-foreground">Urgent Follow-up</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">In 30 Days</div>
            <div className="text-lg font-black text-sky-600 mt-1">{kpis?.in30Days || 24}</div>
            <div className="text-[9px] text-muted-foreground">Quote Prep</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Overdue</div>
            <div className="text-lg font-black text-rose-600 mt-1">{kpis?.overdue || 3}</div>
            <div className="text-[9px] text-rose-600 font-bold">Lapsed Alert</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Renewed</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{kpis?.completed || 14}</div>
            <div className="text-[9px] text-emerald-600 font-bold">Success</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Retention %</div>
            <div className="text-lg font-black text-emerald-600 mt-1">{kpis?.conversionPercentage || '82.5%'}</div>
            <div className="text-[9px] text-muted-foreground">Conversion Rate</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-bold text-muted-foreground uppercase">Revenue</div>
            <div className="text-base font-black text-primary mt-1 truncate">{kpis?.recoveredRevenue || '₹3,42,500'}</div>
            <div className="text-[9px] text-muted-foreground">Recovered GWP</div>
          </div>
        </div>

        {/* Worklist Tabs & Search */}
        <div className="flex border-b text-xs font-semibold overflow-x-auto space-x-4">
          {[
            { id: 'DUE_TODAY', label: 'Due Today (5)' },
            { id: '7_DAYS', label: 'Expiring in 7 Days (12)' },
            { id: '15_DAYS', label: 'Expiring in 15 Days (18)' },
            { id: '30_DAYS', label: 'Expiring in 30 Days (24)' },
            { id: 'OVERDUE', label: 'Overdue / Expired (3)' },
            { id: 'RENEWED', label: 'Successfully Renewed (14)' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 border-b-2 transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary font-bold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Renewal Worklist Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by customer, vehicle #, or policy #..."
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Vehicle Reg #</th>
                  <th className="py-3 px-3">Customer Name</th>
                  <th className="py-3 px-3">Policy Number</th>
                  <th className="py-3 px-3">Insurer</th>
                  <th className="py-3 px-3">Previous GWP</th>
                  <th className="py-3 px-3">Retention Score</th>
                  <th className="py-3 px-3">Expiry</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y text-xs font-semibold">
                {sampleRenewals.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.priority === 'HIGH'
                            ? 'bg-rose-500/10 text-rose-600'
                            : r.priority === 'MEDIUM'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-sky-500/10 text-sky-600'
                        }`}
                      >
                        {r.priority}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-primary">{r.vehicleReg}</td>
                    <td className="py-3 px-3 font-bold text-foreground">{r.customerName}</td>
                    <td className="py-3 px-3 font-mono text-muted-foreground">{r.policyNo}</td>
                    <td className="py-3 px-3 text-muted-foreground">{r.insurer}</td>
                    <td className="py-3 px-3 font-bold text-emerald-600">{r.premium}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: r.retentionScore }).map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-rose-600 font-bold">{r.expiry}</td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Link
                          href="/sales/quotations"
                          className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-extrabold shadow-xs hover:bg-primary/90"
                        >
                          Renewal Quote
                        </Link>
                        <button
                          onClick={() => setSelectedLostTask(r)}
                          className="px-2 py-1 rounded-lg border text-muted-foreground hover:text-rose-600 text-[11px] font-semibold"
                        >
                          Mark Lost
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Lost Reason Analysis Modal */}
        {selectedLostTask && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-rose-600">
                <XCircle className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Lost Renewal Analysis</h3>
              </div>

              <p className="text-muted-foreground">
                Capturing lost reason for policy <strong className="text-foreground">{selectedLostTask.policyNo}</strong> ({selectedLostTask.customerName}).
              </p>

              <form onSubmit={handleMarkLostSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Reason for Loss *</label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                  >
                    <option value="Lost To Competitor">Lost To Competitor</option>
                    <option value="Price Too High">Price Too High</option>
                    <option value="Vehicle Sold">Vehicle Sold</option>
                    <option value="Duplicate Insurance">Duplicate Insurance</option>
                    <option value="No Response">No Response / Unreachable</option>
                    <option value="Policy Cancelled">Policy Cancelled</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Competitor Insurer Name</label>
                  <input
                    type="text"
                    value={competitorName}
                    onChange={(e) => setCompetitorName(e.target.value)}
                    placeholder="e.g. Digit Insurance"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setSelectedLostTask(null)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={markLostMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-rose-600 text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                  >
                    Confirm Lost Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
