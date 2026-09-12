'use client';

import React, { useState } from 'react';
import { AlertTriangle, CheckSquare, Clock, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface CustomerAlertsQueueProps {
  workspace?: any;
}

export function CustomerAlertsQueue({ workspace }: CustomerAlertsQueueProps) {
  const [resolvedAlerts, setResolvedAlerts] = useState<string[]>([]);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);

  const profile = workspace?.profile || workspace?.contact;
  const policies = workspace?.policies || [];
  const claims = workspace?.claims || [];
  const openClaims =
    workspace?.openClaims ||
    claims.filter((c: any) => !['SETTLED', 'CLOSED', 'REJECTED'].includes(c.status));
  const leads = (workspace?.leads || []).filter(
    (l: any) => l.status !== 'CONVERTED' && l.status !== 'LOST',
  );
  const agentName =
    typeof profile?.agent === 'string' && profile?.agent !== 'Unassigned'
      ? profile.agent
      : 'Assigned Agent';

  const alerts: Array<{ id: string; level: 'CRITICAL' | 'WARNING' | 'INFO'; text: string }> = [];
  const tasks: Array<{ id: string; title: string; due: string; assignee: string }> = [];

  const now = new Date();

  // 1. Policy Expiry Alerts & Tasks
  for (const p of policies) {
    if (p.status === 'ACTIVE' || p.status === 'ISSUED') {
      const expDate = p.expiryDate ? new Date(p.expiryDate) : null;
      if (expDate) {
        const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 0) {
          alerts.push({
            id: `exp-${p.id}`,
            level: 'CRITICAL',
            text: `Policy #${p.policyNumber || 'N/A'} has expired (${Math.abs(diffDays)} days ago) — Renewal required.`,
          });
          tasks.push({
            id: `task-exp-${p.id}`,
            title: `Contact customer for urgent renewal of Policy #${p.policyNumber || 'N/A'}`,
            due: 'Overdue',
            assignee: agentName,
          });
        } else if (diffDays <= 15) {
          alerts.push({
            id: `exp-${p.id}`,
            level: 'CRITICAL',
            text: `Policy #${p.policyNumber || 'N/A'} expires in ${diffDays} day${diffDays === 1 ? '' : 's'} — Renewal quote required.`,
          });
          tasks.push({
            id: `task-exp-${p.id}`,
            title: `Issue renewal quote for Policy #${p.policyNumber || 'N/A'}`,
            due: `${diffDays} days left`,
            assignee: agentName,
          });
        } else if (diffDays <= 30) {
          alerts.push({
            id: `exp-${p.id}`,
            level: 'WARNING',
            text: `Policy #${p.policyNumber || 'N/A'} expires in ${diffDays} days — Renewal preparation needed.`,
          });
          tasks.push({
            id: `task-exp-${p.id}`,
            title: `Initiate renewal discussion for Policy #${p.policyNumber || 'N/A'}`,
            due: `In ${diffDays} days`,
            assignee: agentName,
          });
        }
      }
    }
  }

  // 2. Open Claims Alerts & Tasks
  for (const c of openClaims) {
    alerts.push({
      id: `clm-${c.id}`,
      level: 'WARNING',
      text: `Claim #${c.claimNumber || 'CLM-PENDING'} status is ${c.status} — Review pending.`,
    });
    tasks.push({
      id: `task-clm-${c.id}`,
      title: `Follow up with surveyor/insurer on Claim #${c.claimNumber || 'Pending'}`,
      due: 'Pending Review',
      assignee: agentName,
    });
  }

  // 3. KYC Missing Documentation
  const pan = profile?.panNumber;
  const aadhaar = profile?.aadhaarNumber;
  if (!pan || pan === 'NOT_PROVIDED' || pan === 'XXXXX1234F') {
    alerts.push({
      id: 'kyc-pan',
      level: 'INFO',
      text: 'Customer PAN verification pending — KYC update required.',
    });
    tasks.push({
      id: 'task-kyc-pan',
      title: 'Collect & verify PAN card document from customer',
      due: 'Pending KYC',
      assignee: agentName,
    });
  }
  if (!aadhaar || aadhaar === 'NOT_PROVIDED') {
    alerts.push({
      id: 'kyc-aadhaar',
      level: 'INFO',
      text: 'Aadhaar e-KYC documentation pending verification.',
    });
  }

  // 4. Active Pipeline Leads
  for (const l of leads.slice(0, 2)) {
    alerts.push({
      id: `lead-${l.id}`,
      level: 'INFO',
      text: `Active sales lead ${l.leadCode || ''}: "${l.title || 'Inquiry'}" in pipeline.`,
    });
    tasks.push({
      id: `task-lead-${l.id}`,
      title: `Call customer regarding lead "${l.title || 'Inquiry'}"`,
      due: 'Open Lead',
      assignee: agentName,
    });
  }

  const visibleAlerts = alerts.filter((a) => !resolvedAlerts.includes(a.id));
  const visibleTasks = tasks.filter((t) => !completedTasks.includes(t.id));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Active Alerts Panel */}
      <div className="lg:col-span-6 rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Active Customer Alerts</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {visibleAlerts.length} Active
          </span>
        </div>

        <div className="space-y-2">
          {visibleAlerts.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>No active alerts. Customer account is in good standing.</span>
            </div>
          ) : (
            visibleAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                  alert.level === 'CRITICAL'
                    ? 'border-rose-500/30 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                    : alert.level === 'WARNING'
                    ? 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300'
                    : 'border-border bg-muted/20 text-muted-foreground'
                }`}
              >
                <div className="flex items-center space-x-2 overflow-hidden">
                  <span className="font-medium truncate">{alert.text}</span>
                </div>
                <button
                  onClick={() => {
                    setResolvedAlerts((prev) => [...prev, alert.id]);
                    toast.success('Alert resolved');
                  }}
                  className="text-[11px] font-bold text-primary hover:underline ml-2 flex items-center whitespace-nowrap shrink-0"
                >
                  Dismiss <ArrowRight className="h-3 w-3 ml-0.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Workspace Today's Queue */}
      <div className="lg:col-span-6 rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center space-x-2">
            <CheckSquare className="h-4 w-4 text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Workspace Queue & Pending Tasks</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {visibleTasks.length} Pending
          </span>
        </div>

        <div className="space-y-2">
          {visibleTasks.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>All tasks completed. No pending actions for this customer.</span>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg border text-xs bg-muted/10 flex items-center justify-between hover:bg-muted/20 transition-all"
              >
                <div className="space-y-0.5 pr-2">
                  <span className="font-bold text-foreground block">{task.title}</span>
                  <div className="text-[10px] text-muted-foreground flex items-center space-x-2">
                    <span className="flex items-center">
                      <Clock className="h-3 w-3 mr-1" />
                      {task.due}
                    </span>
                    <span>• Assigned: {task.assignee}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setCompletedTasks((prev) => [...prev, task.id]);
                    toast.success('Task marked as done');
                  }}
                  className="px-2.5 py-1 rounded bg-primary/10 text-primary font-bold hover:bg-primary/20 text-[10px] whitespace-nowrap shrink-0"
                >
                  Mark Done
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
