'use client';

import React, { useMemo, useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { GitFork, Clock, AlertTriangle, CheckCircle2, Activity, RefreshCw, Eye, X } from 'lucide-react';
import { useWorkflows, useWorkflowInstances, useSlaMetrics } from '../../../hooks/useWorkflows';

function formatDuration(minutes?: number | null) {
  if (minutes === null || minutes === undefined || !Number.isFinite(Number(minutes))) return 'Not configured';
  const whole = Math.max(0, Number(minutes));
  if (whole < 60) return whole + 'm';
  const hours = Math.floor(whole / 60);
  const remaining = whole % 60;
  return remaining ? hours + 'h ' + remaining + 'm' : hours + 'h';
}

export default function WorkflowAdminPage() {
  const [activeTab, setActiveTab] = useState<'DEFINITIONS' | 'INSTANCES' | 'METRICS'>('DEFINITIONS');
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);
  const {
    data: workflowsResponse,
    isLoading: loadingWorkflows,
    isError: workflowsError,
    refetch: refetchWorkflows,
  } = useWorkflows();
  const {
    data: instancesResponse,
    isLoading: loadingInstances,
    isError: instancesError,
    refetch: refetchInstances,
    isFetching: fetchingInstances,
  } = useWorkflowInstances();
  const { data: metrics, isLoading: loadingMetrics, isError: metricsError, refetch: refetchMetrics } = useSlaMetrics();

  const workflows: any[] = Array.isArray(workflowsResponse)
    ? workflowsResponse
    : Array.isArray((workflowsResponse as any)?.data) ? (workflowsResponse as any).data : [];
  const instances: any[] = Array.isArray(instancesResponse)
    ? instancesResponse
    : Array.isArray((instancesResponse as any)?.data) ? (instancesResponse as any).data : [];

  const selectedTimeline = useMemo(
    () => (Array.isArray(selectedInstance?.timeline) ? selectedInstance.timeline : []),
    [selectedInstance],
  );

  const refreshAll = () => {
    void refetchWorkflows();
    void refetchInstances();
    void refetchMetrics();
  };

  return (
    <AppShell>
      <div className="space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 border-b pb-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
              <GitFork className="h-5 w-5 text-primary" /> Workflow Operations Monitor
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Inspect configured workflow definitions, follow persisted active instances, and check state-level SLA. Empty states are shown when the database has no live records.
            </p>
          </div>
          <button
            type="button"
            onClick={refreshAll}
            disabled={fetchingInstances}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${fetchingInstances ? 'animate-spin' : ''}`} />
            Refresh live data
          </button>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border bg-card p-1 text-xs">
          {[
            { id: 'DEFINITIONS', label: 'Configured flows' },
            { id: 'INSTANCES', label: 'Active instances (' + instances.length + ')' },
            { id: 'METRICS', label: 'SLA metrics' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`rounded-md px-3 py-2 font-bold ${activeTab === tab.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'DEFINITIONS' && (
          <div className="space-y-4">
            {workflowsError ? (
              <LoadError message="Workflow definitions failed to load." retry={() => void refetchWorkflows()} />
            ) : loadingWorkflows ? (
              <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading configured workflows…</div>
            ) : workflows.length === 0 ? (
              <EmptyState title="No workflow definitions configured" detail="No example stages or analytics are inserted as fallback data. Create and activate a workflow definition through the supported configuration process." />
            ) : workflows.map((workflow: any) => {
              const states: any[] = Array.isArray(workflow.states) ? workflow.states : [];
              const transitions: any[] = Array.isArray(workflow.transitions) ? workflow.transitions : [];
              return (
                <section key={workflow.id} className="rounded-xl border bg-card p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-sm font-bold">{workflow.name}</h2>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${workflow.active ? 'text-emerald-700 border-emerald-500/30 bg-emerald-500/5' : 'text-muted-foreground'}`}>
                          {workflow.active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {workflow.code} · {workflow.module} · version {workflow.version}
                      </p>
                      {workflow.description && <p className="mt-2 text-xs">{workflow.description}</p>}
                    </div>
                    <div className="flex gap-3 text-[11px] text-muted-foreground">
                      <span>{states.length} states</span><span>{transitions.length} transitions</span>
                    </div>
                  </div>

                  {states.length > 0 ? (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {states.map((state: any, index: number) => {
                        const outgoing = transitions.filter((transition: any) => transition.fromStateId === state.id);
                        return (
                          <React.Fragment key={state.id}>
                            <div className="min-w-[175px] rounded-lg border p-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground">{state.code}</span>
                                {state.isInitial && <span className="text-[9px] font-bold text-primary">INITIAL</span>}
                                {state.isTerminal && <span className="text-[9px] font-bold text-emerald-700">TERMINAL</span>}
                              </div>
                              <div className="mt-1 text-xs font-bold">{state.name}</div>
                              <div className="mt-2 text-[10px] text-muted-foreground">
                                SLA: {formatDuration(state.slaMinutes)}
                              </div>
                              <div className="mt-1 text-[10px] text-muted-foreground">
                                {outgoing.length} outgoing transition{outgoing.length === 1 ? '' : 's'}
                              </div>
                            </div>
                            {index < states.length - 1 && <div className="flex items-center px-1 text-muted-foreground">→</div>}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">This definition has no configured states.</p>
                  )}

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold">Transitions</h3>
                    {transitions.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No transitions configured.</p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                            <tr><th className="p-2.5">Transition</th><th className="p-2.5">From</th><th className="p-2.5">To</th><th className="p-2.5">Trigger</th><th className="p-2.5">Assignments</th></tr>
                          </thead>
                          <tbody className="divide-y">
                            {transitions.map((transition: any) => (
                              <tr key={transition.id}>
                                <td className="p-2.5 font-semibold">{transition.name}</td>
                                <td className="p-2.5">{transition.fromState?.name || 'Initial / any'}</td>
                                <td className="p-2.5">{transition.toState?.name || '—'}</td>
                                <td className="p-2.5">{transition.triggerType || 'MANUAL'}</td>
                                <td className="p-2.5">
                                  {(transition.assignments || []).map((assignment: any) =>
                                    assignment.user?.email || assignment.role?.name || assignment.departmentId || assignment.branchId
                                  ).filter(Boolean).join(', ') || 'No explicit assignment'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        {activeTab === 'INSTANCES' && (
          instancesError ? (
            <LoadError message="Live workflow instances failed to load." retry={() => void refetchInstances()} />
          ) : loadingInstances ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Loading persisted workflow instances…</div>
          ) : instances.length === 0 ? (
            <EmptyState title="No active workflow instances" detail="No non-terminal workflow history was found for the current organization. Terminal history is intentionally not presented as active work." />
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 text-[10px] uppercase text-muted-foreground">
                  <tr><th className="p-3">Workflow / Entity</th><th className="p-3">Current state</th><th className="p-3">Entered state</th><th className="p-3">Time in state</th><th className="p-3">SLA</th><th className="p-3">Assignment</th><th className="p-3">Details</th></tr>
                </thead>
                <tbody className="divide-y">
                  {instances.map((instance: any) => (
                    <tr key={instance.id} className="hover:bg-accent/30">
                      <td className="p-3">
                        <div className="font-bold">{instance.workflowName}</div>
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{instance.entityType} · {instance.entityNumber || instance.entityId}</div>
                        {instance.customerName && <div className="mt-1 text-[10px]">{instance.customerName}</div>}
                      </td>
                      <td className="p-3 font-semibold">{instance.currentState || instance.currentStateCode}</td>
                      <td className="p-3">{instance.enteredAt ? new Date(instance.enteredAt).toLocaleString('en-IN') : '—'}</td>
                      <td className="p-3">{formatDuration(instance.minutesInState)}</td>
                      <td className="p-3">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold ${instance.slaStatus === 'BREACHED' ? 'text-red-700 border-red-500/30 bg-red-500/5' : instance.slaStatus === 'ON_TRACK' ? 'text-emerald-700 border-emerald-500/30 bg-emerald-500/5' : 'text-muted-foreground'}`}>
                          {instance.slaStatus === 'NOT_CONFIGURED' ? 'NOT CONFIGURED' : instance.slaStatus || 'UNKNOWN'}
                        </span>
                        {instance.minutesRemaining !== null && instance.minutesRemaining !== undefined && <div className="mt-1 text-[10px] text-muted-foreground">{instance.slaStatus === 'BREACHED' ? 'Overdue' : formatDuration(instance.minutesRemaining) + ' left'}</div>}
                      </td>
                      <td className="p-3">{instance.assignedApprover || 'Unassigned'}</td>
                      <td className="p-3">
                        <button type="button" onClick={() => setSelectedInstance(instance)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1.5 text-[10px] font-semibold hover:bg-accent">
                          <Eye className="h-3 w-3" /> Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {activeTab === 'METRICS' && (
          metricsError ? (
            <LoadError message="Live SLA metrics failed to load." retry={() => void refetchMetrics()} />
          ) : loadingMetrics ? (
            <div className="rounded-xl border p-8 text-center text-sm text-muted-foreground">Calculating metrics from persisted workflow history…</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <Metric label="Active instances" value={metrics?.runningInstances} />
              <Metric label="Instances with SLA configured" value={metrics?.trackedInstances} />
              <Metric label="Current-stage breaches" value={metrics?.breachedCount} warning={Boolean(metrics?.breachedCount)} />
              <Metric label="Current-stage compliance" value={metrics?.overallCompliancePct == null ? null : metrics.overallCompliancePct + '%'} />
              <Metric label="Lead SLA compliance" value={metrics?.leadsSlaCompliancePct == null ? null : metrics.leadsSlaCompliancePct + '%'} />
              <Metric label="Claim SLA compliance" value={metrics?.claimsSlaCompliancePct == null ? null : metrics.claimsSlaCompliancePct + '%'} />
              <Metric label="Average time in current stage" value={metrics?.avgCurrentStageHours == null ? null : metrics.avgCurrentStageHours + ' hours'} />
            </div>
          )
        )}
      </div>

      {selectedInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-2xl border bg-card p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h2 className="text-sm font-bold">Workflow instance timeline</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">{selectedInstance.workflowName} · {selectedInstance.entityType} · {selectedInstance.entityNumber || selectedInstance.entityId}</p>
              </div>
              <button type="button" onClick={() => setSelectedInstance(null)} className="rounded-md p-1 hover:bg-accent" aria-label="Close instance details"><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Current state</div><div className="mt-1 font-bold">{selectedInstance.currentState || '—'}</div></div>
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Assigned role / user</div><div className="mt-1 font-bold">{selectedInstance.assignedApprover || 'Unassigned'}</div></div>
              <div className="rounded-lg border p-3"><div className="text-muted-foreground">Current SLA</div><div className="mt-1 font-bold">{selectedInstance.slaStatus || 'Unknown'} {selectedInstance.minutesRemaining == null ? '' : '· ' + formatDuration(selectedInstance.minutesRemaining) + ' remaining'}</div></div>
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Persisted state transition history</h3>
              {selectedTimeline.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">No transition history was returned for this instance.</p>
              ) : selectedTimeline.map((step: any, index: number) => (
                <div key={step.timestamp + ':' + index} className="rounded-lg border p-3 space-y-1 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold">{step.action || step.state}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{new Date(step.timestamp).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="text-muted-foreground">By {step.performedBy || 'System'}</div>
                  {step.comments && <p className="text-muted-foreground italic">{step.comments}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-xl border border-dashed bg-card p-10 text-center"><Activity className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-3 text-sm font-bold">{title}</h2><p className="mx-auto mt-1 max-w-xl text-xs text-muted-foreground">{detail}</p></div>;
}

function LoadError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4"><p className="text-sm font-semibold">{message}</p><button type="button" onClick={retry} className="mt-3 rounded-md border px-3 py-1.5 text-xs font-semibold">Retry</button></div>;
}

function Metric({ label, value, warning = false }: { label: string; value?: string | number | null; warning?: boolean }) {
  return <div className="rounded-xl border bg-card p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div><div className={`mt-2 text-2xl font-black ${warning ? 'text-destructive' : 'text-foreground'}`}>{value === null || value === undefined ? '—' : value}</div></div>;
}
