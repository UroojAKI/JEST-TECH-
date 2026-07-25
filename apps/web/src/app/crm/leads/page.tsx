'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Users, Plus, LayoutGrid, List, Flame, Sparkles, Loader2, X, ArrowRight, UserCheck } from 'lucide-react';
import { LeadItem, LeadStatus } from '../../../types/leads';
import { useLeads } from '../../../hooks/useLeads';
import { leadsRepository } from '../../../repositories/leads.repository';
import { adminRepository, UserItem } from '../../../repositories/admin.repository';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/formatters';

const STAGES: { status: LeadStatus; label: string }[] = [
  { status: 'NEW', label: '1. NEW' },
  { status: 'CONTACTED', label: '2. CONTACTED' },
  { status: 'DOCS_RECEIVED', label: '3. DOCS RECEIVED' },
  { status: 'QUOTE_PREPARED', label: '4. QUOTE PREPARED' },
  { status: 'NEGOTIATION', label: '5. NEGOTIATION' },
  { status: 'PAYMENT_RECEIVED', label: '6. PAYMENT RECEIVED' },
  { status: 'POLICY_ISSUED', label: '7. POLICY ISSUED' },
];

export default function LeadsWorkspacePage() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<'TABLE' | 'KANBAN'>('KANBAN');
  const [savedView, setSavedView] = useState<string>('MY_WORK');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [agentsList, setAgentsList] = useState<UserItem[]>([]);

  const { leads: apiLeads, isLoading, isError, refetch, updateStatus } = useLeads();

  useEffect(() => {
    adminRepository.getUsers().then((data) => {
      if (Array.isArray(data)) {
        setAgentsList(data);
      }
    }).catch(() => {
      // Fallback
      setAgentsList([]);
    });
  }, []);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    productInterest: 'Motor Comprehensive',
    expectedPremium: 25000,
    priority: 'HOT',
    source: 'WEBSITE',
    assignedAgentId: '',
  });

  const handleAddLeadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName || !formData.phone) {
      toast.error('First name and phone number are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await leadsRepository.createLead({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        productInterest: formData.productInterest,
        expectedPremium: Number(formData.expectedPremium),
        priority: formData.priority as any,
        source: formData.source as any,
      });

      toast.success(`Lead "${formData.firstName} ${formData.lastName}" created successfully!`);
      setShowAddModal(false);
      setFormData({ firstName: '', lastName: '', email: '', phone: '', productInterest: 'Motor Comprehensive', expectedPremium: 25000, priority: 'HOT', source: 'WEBSITE' });
      refetch();
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to create lead via API';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const leadsList: LeadItem[] = (apiLeads || []).map((l: any) => ({
    id: l.id,
    leadCode: l.leadCode || l.id,
    firstName: l.firstName || 'Prospect',
    lastName: l.lastName || '',
    email: l.email || '',
    phone: l.phone || '',
    status: l.status || 'NEW',
    source: l.source || 'CRM',
    productInterest: l.productInterest || 'General Insurance',
    priority: l.priority || 'WARM',
    expectedPremium: l.expectedPremium || 0,
    probabilityScore: l.probabilityScore || 70,
    assignedAgentName: l.assignedAgentName || 'Sales Agent',
    tags: l.tags || ['NEW'],
    slaStatus: 'ON_TRACK',
    slaTimeRemaining: '2h',
    daysInPipeline: 1,
    createdAt: l.createdAt || new Date().toISOString(),
  }));

  const filteredData = leadsList.filter((l) => {
    if (savedView === 'MY_WORK') return true;
    if (savedView === 'TODAY_FOLLOWUPS') return l.priority === 'HOT';
    if (savedView === 'LOST') return l.status === 'LOST';
    return true;
  });

  const columns = [
    {
      accessorKey: 'leadCode',
      header: 'Lead Code',
      cell: ({ row }: any) => (
        <span
          onClick={() => router.push(`/crm/leads/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold text-primary"
        >
          {row.original.leadCode}
        </span>
      ),
    },
    {
      accessorKey: 'name',
      header: 'Prospect Name',
      cell: ({ row }: any) => `${row.original.firstName} ${row.original.lastName}`.trim(),
    },
    { accessorKey: 'productInterest', header: 'Product' },
    {
      accessorKey: 'expectedPremium',
      header: 'Expected Premium',
      cell: ({ row }: any) => (
        <span suppressHydrationWarning>{formatCurrency(row.original.expectedPremium)}</span>
      ),
    },
    {
      accessorKey: 'probabilityScore',
      header: 'Score',
      cell: ({ row }: any) => (
        <span className="font-bold text-primary">{row.original.probabilityScore} / 100</span>
      ),
    },
    { accessorKey: 'assignedAgentName', header: 'Assigned Agent' },
    {
      accessorKey: 'status',
      header: 'Stage',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Lead Management Workspace
          </h1>
          <p className="text-xs text-muted-foreground">Enterprise sales acquisition pipeline & daily work queue</p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
          {/* View Toggle */}
          <div className="flex rounded-lg border bg-card p-0.5 text-xs">
            <button
              onClick={() => setViewMode('KANBAN')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md font-semibold transition-colors ${
                viewMode === 'KANBAN' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Kanban Board</span>
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`flex items-center space-x-1 px-3 py-1 rounded-md font-semibold transition-colors ${
                viewMode === 'TABLE' ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Table Register</span>
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
          >
            <Plus className="h-4 w-4" />
            <span>+ Add Lead</span>
          </button>
        </div>
      </div>

      {/* Add Lead Modal / Form */}
      {showAddModal && (
        <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Create New Prospect Lead
            </h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleAddLeadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. Rahul"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Last Name</label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Patil"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahul@gmail.com"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Product Interest</label>
                <select
                  value={formData.productInterest}
                  onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="Motor Comprehensive">Motor Comprehensive</option>
                  <option value="Health Optima Family">Health Optima Family</option>
                  <option value="Group Health Insurance">Group Health Insurance</option>
                  <option value="Life Term Plan">Life Term Plan</option>
                  <option value="Commercial Property">Commercial Property</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Expected Premium (₹)</label>
                <input
                  type="number"
                  value={formData.expectedPremium}
                  onChange={(e) => setFormData({ ...formData, expectedPremium: Number(e.target.value) })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Priority</label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="HOT">HOT 🔥</option>
                  <option value="WARM">WARM ☀️</option>
                  <option value="COLD">COLD ❄️</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Lead Source</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="WEBSITE">WEBSITE</option>
                  <option value="WHATSAPP">WHATSAPP</option>
                  <option value="REFERRAL">REFERRAL</option>
                  <option value="WALK_IN">WALK_IN</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Assigned Sales Agent</label>
                <select
                  value={formData.assignedAgentId}
                  onChange={(e) => setFormData({ ...formData, assignedAgentId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary font-semibold"
                >
                  <option value="">Auto-Assign / Unassigned</option>
                  {agentsList.map((ag) => (
                    <option key={ag.id} value={ag.id}>
                      {ag.firstName} {ag.lastName} ({ag.role || 'AGENT'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border bg-background hover:bg-accent text-foreground font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSubmitting ? 'Creating Lead...' : 'Create Lead'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* "My Work" & Saved Views Bar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'MY_WORK', label: "My Work Queue" },
          { id: 'TODAY_FOLLOWUPS', label: "Today's Follow-ups" },
          { id: 'OVERDUE', label: "Overdue" },
          { id: 'QUOTES_PENDING', label: "Quotes Pending" },
          { id: 'LOST', label: "Lost Leads" },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading lead pipeline from API...</div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-red-500">Failed to load leads from API.</div>
      ) : viewMode === 'KANBAN' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 pt-2 snap-x">
          {STAGES.map((stage) => {
            const stageLeads = filteredData.filter((l) => l.status === stage.status);
            const totalGwp = stageLeads.reduce((acc, curr) => acc + (curr.expectedPremium || 0), 0);

            return (
              <div key={stage.status} className="rounded-xl border bg-card p-3 space-y-3 min-w-[280px] max-w-[300px] flex-shrink-0 shadow-sm snap-start">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="font-bold text-[11px] uppercase tracking-wider text-foreground">{stage.label}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {stageLeads.length}
                  </span>
                </div>

                <div className="text-[10px] text-muted-foreground font-semibold flex justify-between items-center">
                  <span>Expected GWP:</span>
                  <span className="font-bold text-emerald-600" suppressHydrationWarning>
                    {formatCurrency(totalGwp)}
                  </span>
                </div>

                <div className="space-y-2">
                  {stageLeads.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border bg-background hover:border-primary cursor-pointer transition-all shadow-sm space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start" onClick={() => router.push(`/crm/leads/${item.id}`)}>
                        <span className="font-extrabold text-foreground text-sm">{item.firstName} {item.lastName}</span>
                        <span className="text-[10px] font-bold text-amber-500 flex items-center bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          <Flame className="h-3 w-3 mr-0.5" />
                          {item.priority}
                        </span>
                      </div>

                      <div className="text-[11px] text-muted-foreground" onClick={() => router.push(`/crm/leads/${item.id}`)}>
                        {item.productInterest}
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t text-[11px]">
                        <span className="font-extrabold text-emerald-600" suppressHydrationWarning>
                          {formatCurrency(item.expectedPremium)}
                        </span>
                        <span className="text-primary font-bold text-[10px] bg-primary/10 px-1.5 py-0.5 rounded">
                          Score: {item.probabilityScore}/100
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 border-t text-[10px]">
                        <span className="text-muted-foreground font-mono">{item.slaTimeRemaining}</span>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            const stageIndex = STAGES.findIndex((s) => s.status === item.status);
                            if (stageIndex < STAGES.length - 1) {
                              const nextStage = STAGES[stageIndex + 1].status;
                              try {
                                await updateStatus({ id: item.id, status: nextStage });
                                toast.success(`Advanced lead to stage: ${STAGES[stageIndex + 1].label}`);
                                refetch();
                              } catch (err: any) {
                                toast.error(err?.message || 'Failed to update stage');
                              }
                            } else {
                              toast.info('Lead has reached final Policy Issued stage!');
                            }
                          }}
                          className="px-2.5 py-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all shadow-sm flex items-center space-x-1 text-[10px]"
                        >
                          <span>Advance Stage</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="p-4 text-center text-muted-foreground text-[10px] border border-dashed rounded-xl">
                      No leads in this stage. Click &quot;+ Add Lead&quot; above to create one.
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EnterpriseTable data={filteredData} columns={columns} />
      )}
    </AppShell>
  );
}
