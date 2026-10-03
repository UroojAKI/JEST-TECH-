'use client';

import { AlertTriangle, CheckSquare, Clock, CheckCircle2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { taskRepository } from '../../repositories/task.repository';

interface CustomerAlertsQueueProps {
  workspace?: any;
}

export function CustomerAlertsQueue({ workspace }: CustomerAlertsQueueProps) {
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
  const tasks: Array<{
    id: string;
    title: string;
    due: string;
    assignee: string;
    priority: 'MEDIUM' | 'HIGH' | 'URGENT';
    policyId?: string;
    claimId?: string;
    leadId?: string;
  }> = [];

  const queryClient = useQueryClient();
  const createTask = useMutation({
    mutationFn: (task: (typeof tasks)[number]) => {
      const customerId = profile?.customerId;
      if (!customerId) throw new Error('This contact is not linked to a customer account.');
      return taskRepository.createTask({
        title: task.title,
        description: 'Created from a Customer 360 follow-up suggestion.',
        type: 'FOLLOW_UP',
        priority: task.priority,
        customerId,
        policyId: task.policyId,
        claimId: task.claimId,
        leadId: task.leadId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Follow-up task created');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'Could not create task');
    },
  });

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
            priority: 'URGENT',
            policyId: p.id,
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
            priority: 'HIGH',
            policyId: p.id,
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
            priority: 'MEDIUM',
            policyId: p.id,
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
      priority: 'HIGH',
      claimId: c.id,
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
      priority: 'MEDIUM',
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
      priority: 'MEDIUM',
      leadId: l.id,
    });
  }

  const visibleAlerts = alerts;
  const visibleTasks = tasks;

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
              <span>No current alert conditions were found.</span>
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
            <h3 className="text-xs font-bold uppercase tracking-wider">Suggested Follow-ups</h3>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {visibleTasks.length} Suggested
          </span>
        </div>

        <div className="space-y-2">
          {visibleTasks.length === 0 ? (
            <div className="p-4 rounded-lg border border-dashed text-center text-xs text-muted-foreground flex flex-col items-center gap-1">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <span>No follow-up suggestions are currently available.</span>
            </div>
          ) : (
            visibleTasks.map((task) => (
              <div
                key={task.id}
                className="p-2.5 rounded-lg border text-xs bg-muted/10 flex items-center justify-between hover:bg-muted/20 transition-all"
              >
                {profile?.customerId && (
                  <button
                    type="button"
                    onClick={() => createTask.mutate(task)}
                    disabled={createTask.isPending}
                    className="order-2 shrink-0 rounded border px-2 py-1 text-[10px] font-semibold text-primary hover:bg-primary/10 disabled:opacity-50"
                  >
                    {createTask.isPending ? 'Saving…' : 'Create task'}
                  </button>
                )}
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
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
