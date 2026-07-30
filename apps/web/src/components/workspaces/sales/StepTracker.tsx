'use client';

import React, { useState } from 'react';
import { useAuthStore } from '../../../store/auth-store';
import { CheckCircle2, ChevronRight, AlertTriangle, ShieldAlert, Info, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

export const WORKFLOW_STEPS = [
  { id: 'ASSIGNED', title: 'Assigned', desc: 'Lead allocated to sales agent' },
  { id: 'CONTACTED', title: 'Contacted', desc: 'Initial call/meeting logged' },
  { id: 'NEED_ANALYSIS', title: 'Need Analysis', desc: 'Requirements gathered' },
  { id: 'QUOTATION', title: 'Quotation', desc: 'Quotation generated' },
  { id: 'PROPOSAL', title: 'Proposal', desc: 'Proposal document ready' },
  { id: 'NEGOTIATION', title: 'Negotiation', desc: 'Price/terms negotiated' },
  { id: 'PAYMENT', title: 'Payment', desc: 'Payment collected/verified' },
  { id: 'ISSUED', title: 'Issued', desc: 'Policy issued successfully' },
  { id: 'REFERRAL', title: 'Referral', desc: 'Referral captured/exempted' },
  { id: 'CRM_UPDATED', title: 'CRM Updated', desc: 'Final CRM checklist completed' },
];

interface StepTrackerProps {
  currentStep: string;
  leadId: string;
  onMoveStage: (targetStage: string, overrideReason?: string, remarks?: string) => void;
  isMoving?: boolean;
}

export function StepTracker({ currentStep, leadId, onMoveStage, isMoving }: StepTrackerProps) {
  const { user } = useAuthStore();
  const userRole = user?.roles?.[0] || 'SALES_AGENT';

  const isManagerOrAdmin =
    userRole === 'BRANCH_MANAGER' ||
    userRole === 'TEAM_LEADER' ||
    userRole === 'SUPER_ADMIN' ||
    userRole === 'ADMIN';

  const currentIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);
  const activeIdx = currentIndex === -1 ? 0 : currentIndex;

  const [overrideModalStep, setOverrideModalStep] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [remarks, setRemarks] = useState('');

  const nextStep = WORKFLOW_STEPS[activeIdx + 1];

  const handleStepClick = (targetStepId: string, targetIdx: number) => {
    if (targetStepId === currentStep) return;

    // Standard Sales Executive: can only move to immediate next step
    if (!isManagerOrAdmin) {
      if (targetIdx !== activeIdx + 1) {
        toast.error(
          `Sales Executives can only move sequentially to the immediate next step (${
            WORKFLOW_STEPS[activeIdx + 1]?.title || 'Completed'
          }). Skipping steps requires Sales Manager override.`
        );
        return;
      }
      onMoveStage(targetStepId);
      return;
    }

    // Manager / Admin: If target is not immediate next step, trigger override prompt
    if (targetIdx !== activeIdx + 1) {
      setOverrideModalStep(targetStepId);
      setOverrideReason('');
      setRemarks('');
    } else {
      onMoveStage(targetStepId);
    }
  };

  const submitOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideReason || overrideReason.trim().length < 5) {
      toast.error('Mandatory override reason (minimum 5 characters) required for Sales Manager override.');
      return;
    }
    if (overrideModalStep) {
      onMoveStage(overrideModalStep, overrideReason, remarks);
      setOverrideModalStep(null);
    }
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl border bg-card text-card-foreground shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Controlled Sales SOP Workflow</span>
          <h3 className="text-sm font-extrabold text-foreground tracking-tight">10-Step Sequential Stage Progression</h3>
        </div>

        {nextStep && (
          <button
            onClick={() => handleStepClick(nextStep.id, activeIdx + 1)}
            disabled={isMoving}
            className="px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all disabled:opacity-50"
          >
            <span>Advance to {nextStep.title}</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Step Tracker Visual Line */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center min-w-[850px] space-x-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isCompleted = idx < activeIdx;
            const isCurrent = idx === activeIdx;

            return (
              <React.Fragment key={step.id}>
                <button
                  type="button"
                  onClick={() => handleStepClick(step.id, idx)}
                  disabled={isMoving}
                  title={`${step.title}: ${step.desc}`}
                  className={`flex-1 p-2 rounded-xl border text-left transition-all relative ${
                    isCurrent
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs ring-1 ring-primary'
                      : isCompleted
                      ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600 font-semibold'
                      : 'border-muted bg-muted/20 text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold">Step {idx + 1}</span>
                    {isCompleted ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    ) : isCurrent ? (
                      <span className="h-2 w-2 rounded-full bg-primary animate-ping" />
                    ) : null}
                  </div>

                  <div className="text-[11px] font-bold truncate mt-0.5">{step.title}</div>
                </button>

                {idx < WORKFLOW_STEPS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Sales Manager Override Modal */}
      {overrideModalStep && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-600">
              <ShieldAlert className="h-5 w-5 shrink-0" />
              <h3 className="text-sm font-extrabold text-foreground">Sales Manager Workflow Override</h3>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              You are overriding the Controlled Sequential Workflow to jump stage from{' '}
              <strong className="text-foreground">{WORKFLOW_STEPS[activeIdx]?.title}</strong> to{' '}
              <strong className="text-primary">{WORKFLOW_STEPS.find((s) => s.id === overrideModalStep)?.title}</strong>.
              This action will be logged in the permanent audit trail.
            </p>

            <form onSubmit={submitOverride} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">
                  Mandatory Override Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="e.g. Approved exception due to pre-verified corporate quote..."
                  className="w-full p-2.5 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-foreground block mb-1">Additional Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional manager note"
                  className="w-full p-2.5 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setOverrideModalStep(null)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isMoving}
                  className="px-4 py-1.5 text-xs font-extrabold rounded-xl bg-amber-600 text-white shadow-xs hover:bg-amber-700 disabled:opacity-50"
                >
                  Confirm Manager Override
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
