'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import {
  GitFork,
  ArrowRight,
  Clock,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Layers,
  Eye,
  X,
} from 'lucide-react';
import { useWorkflows, useWorkflowInstances } from '../../../hooks/useWorkflows';
import { StatusBadge } from '../../../components/ui/status-badge';

export default function WorkflowAdminPage() {
  const [activeTab, setActiveTab] = useState<'DESIGNER' | 'INSTANCES' | 'ANALYTICS'>('DESIGNER');
  const [selectedInstance, setSelectedInstance] = useState<any | null>(null);

  const { data: workflowsData, isLoading: isLoadingWorkflows } = useWorkflows();
  const { data: instancesData, isLoading: isLoadingInstances, refetch: refetchInstances } = useWorkflowInstances();

  const workflows = Array.isArray(workflowsData) ? workflowsData : (workflowsData as any)?.data || [];
  const instances = Array.isArray(instancesData) ? instancesData : (instancesData as any)?.data || [];

  const defaultNodes = [
    { id: 'draft', name: '1. Draft Proposal', role: 'Sales Agent', sla: '4h', escalatesTo: 'Team Leader' },
    { id: 'underwriting', name: '2. Underwriting Review', role: 'Underwriter', sla: '8h', escalatesTo: 'Chief Underwriter' },
    { id: 'manager_approval', name: '3. Manager Approval', role: 'Branch Manager', sla: '6h', escalatesTo: 'Zonal Head' },
    { id: 'policy_issuance', name: '4. Policy Issuance', role: 'Operations', sla: '2h', escalatesTo: 'Ops Lead' },
    { id: 'completed', name: '5. Issued & Active', role: 'System', sla: 'None', escalatesTo: 'None' },
  ];

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <GitFork className="h-5 w-5 text-primary" /> Enterprise Visual Workflow Engine & Live Monitor
          </h1>
          <p className="text-xs text-muted-foreground">
            Design multi-stage approval flows, node transitions, SLA timers, role escalations, and track running workflow instances
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center space-x-1 border rounded-lg p-1 bg-card text-xs">
          {[
            { id: 'DESIGNER', label: 'Workflow Designer & Node Graph' },
            { id: 'INSTANCES', label: `Running Instances (${instances.length})` },
            { id: 'ANALYTICS', label: 'Workflow Bottleneck Analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded-md font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 1. DESIGNER & NODE GRAPH */}
      {activeTab === 'DESIGNER' && (
        <div className="space-y-6 text-xs">
          {/* Visual Node Graph Strip */}
          <div className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center space-x-2">
                <Activity className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm">Underwriting & Proposal Approval Node Graph</h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Authoritative Node Architecture
              </span>
            </div>

            {/* Nodes Container */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative pt-2">
              {defaultNodes.map((node) => (
                <div
                  key={node.id}
                  className="p-4 rounded-xl border bg-muted/10 hover:border-primary/50 transition-all space-y-2 relative"
                >
                  <div className="font-extrabold text-foreground text-xs">{node.name}</div>
                  <div className="text-[10px] text-primary font-bold">{node.role}</div>

                  <div className="pt-2 border-t space-y-1 text-[10px]">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">SLA Limit:</span>
                      <strong className="text-foreground">{node.sla}</strong>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Escalation:</span>
                      <span className="font-semibold text-foreground">{node.escalatesTo}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. RUNNING WORKFLOW INSTANCES */}
      {activeTab === 'INSTANCES' && (
        <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
          {instances.length === 0 ? (
            <div className="p-12 text-center space-y-2">
              <GitFork className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No Running Workflow Instances</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All workflows have been settled or are waiting for next trigger.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                  <th className="p-3">Instance ID</th>
                  <th className="p-3">Entity No.</th>
                  <th className="p-3">Current State</th>
                  <th className="p-3">SLA Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {instances.map((inst: any) => (
                  <tr key={inst.id} className="hover:bg-accent/40">
                    <td className="p-3 font-mono font-bold text-primary">{inst.id}</td>
                    <td className="p-3 font-mono">{inst.entityNumber || inst.entityId}</td>
                    <td className="p-3 font-bold text-emerald-600">{inst.currentState || inst.status}</td>
                    <td className="p-3 text-muted-foreground">{inst.slaStatus || 'ON_TRACK'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 3. WORKFLOW ANALYTICS */}
      {activeTab === 'ANALYTICS' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Most Used Workflow</span>
            <div className="text-base font-extrabold text-primary">Proposal Underwriting</div>
            <span className="text-[10px] text-muted-foreground">1,420 Executions/Mo</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Average Duration</span>
            <div className="text-base font-extrabold text-emerald-600">4h 15m</div>
            <span className="text-[10px] text-emerald-600 font-semibold">-22% vs last month</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Bottleneck Stage</span>
            <div className="text-base font-extrabold text-amber-600">Underwriting Review</div>
            <span className="text-[10px] text-amber-600 font-semibold">Avg 3h 12m delay</span>
          </div>

          <div className="p-4 rounded-xl border bg-card space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">Auto-Approved %</span>
            <div className="text-base font-extrabold text-emerald-600">42.8%</div>
            <span className="text-[10px] text-muted-foreground">Straight-Through Processing</span>
          </div>
        </div>
      )}

      {/* Running Workflow Instance Viewer Modal */}
      {selectedInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-card border rounded-2xl shadow-2xl p-6 space-y-4 text-xs">
            <div className="flex justify-between items-center border-b pb-2">
              <h3 className="font-bold text-sm">Workflow Instance Audit: {selectedInstance.entityNumber}</h3>
              <button onClick={() => setSelectedInstance(null)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border bg-muted/10">
              <div>Customer: <strong>{selectedInstance.customerName}</strong></div>
              <div>Current Stage: <strong className="text-emerald-600">{selectedInstance.currentState}</strong></div>
              <div>Assigned Approver: <strong>{selectedInstance.assignedApprover}</strong></div>
              <div>Time Spent: <strong className="font-mono">{selectedInstance.timeSpent}</strong></div>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-xs uppercase text-muted-foreground">State Transition Audit Trail</h4>
              <div className="space-y-2">
                {selectedInstance.timeline.map((step: any, idx: number) => (
                  <div key={idx} className="p-3 rounded-lg border bg-background space-y-1">
                    <div className="flex justify-between font-bold">
                      <span>{step.state}</span>
                      <span className="text-primary">{step.action}</span>
                    </div>
                    <div className="text-muted-foreground text-[10px]">By {step.performedBy} on {step.timestamp}</div>
                    {step.comments && <p className="text-muted-foreground italic mt-1">"{step.comments}"</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
