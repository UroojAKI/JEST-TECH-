'use client';

import React from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { StatusBadge } from '../ui/status-badge';

export type WorkflowStageKey =
  | 'lead'
  | 'contacted'
  | 'qualified'
  | 'quotation'
  | 'proposal'
  | 'payment'
  | 'policy'
  | 'renewal';

export interface WorkflowStage {
  key: WorkflowStageKey;
  label: string;
  shortLabel?: string;
  defaultHref?: string;
}

export const WORKFLOW_STAGES: WorkflowStage[] = [
  { key: 'lead', label: 'New Lead', shortLabel: 'Lead', defaultHref: '/crm/leads' },
  { key: 'contacted', label: 'Contacted', shortLabel: 'Contact' },
  { key: 'qualified', label: 'Qualified', shortLabel: 'Qualified' },
  { key: 'quotation', label: 'Quotation', shortLabel: 'Quote', defaultHref: '/sales/quotations' },
  { key: 'proposal', label: 'Proposal', shortLabel: 'Proposal' },
  { key: 'payment', label: 'Payment', shortLabel: 'Payment' },
  { key: 'policy', label: 'Policy Issued', shortLabel: 'Policy', defaultHref: '/policies' },
  { key: 'renewal', label: 'Renewal', shortLabel: 'Renewal', defaultHref: '/renewals' },
];

export interface WorkflowProgressHeaderProps {
  currentStep: WorkflowStageKey | number;
  status?: string;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  nextAction?: {
    label: string;
    onClick?: () => void;
    href?: string;
    icon?: React.ComponentType<{ className?: string }>;
    disabled?: boolean;
    variant?: 'primary' | 'success' | 'outline';
  };
  onStepClick?: (stage: WorkflowStage, index: number) => void;
}

export function WorkflowProgressHeader({
  currentStep,
  status,
  title,
  subtitle,
  backHref,
  backLabel = 'Back',
  nextAction,
  onStepClick,
}: WorkflowProgressHeaderProps) {
  const currentStageIndex =
    typeof currentStep === 'number'
      ? currentStep
      : WORKFLOW_STAGES.findIndex((s) => s.key === currentStep);

  const activeIndex = currentStageIndex >= 0 ? currentStageIndex : 0;
  const currentStage = WORKFLOW_STAGES[activeIndex] || WORKFLOW_STAGES[0];

  const NextIcon = nextAction?.icon || ArrowRight;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-xs p-4 sm:p-5 space-y-4">
      {/* Top row: Navigation back + Title + Status + Next CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
        <div className="flex items-center space-x-3">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{backLabel}</span>
            </Link>
          )}

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] uppercase font-bold tracking-wider text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>Insurance Sales Pipeline</span>
              </span>
              {status && <StatusBadge status={status} />}
            </div>
            {title && <h2 className="text-base sm:text-lg font-black tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>

        {nextAction && (
          <div className="flex items-center self-end sm:self-center">
            {nextAction.href ? (
              <Link
                href={nextAction.href}
                className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all ${
                  nextAction.variant === 'success'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <span>{nextAction.label}</span>
                <NextIcon className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <button
                type="button"
                onClick={nextAction.onClick}
                disabled={nextAction.disabled}
                className={`inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-xl shadow-xs transition-all disabled:opacity-50 ${
                  nextAction.variant === 'success'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                <span>{nextAction.label}</span>
                <NextIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stepper track */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
          <span>
            Stage {activeIndex + 1} of {WORKFLOW_STAGES.length}:{' '}
            <strong className="text-foreground">{currentStage.label}</strong>
          </span>
          <span className="font-semibold text-[10px] text-primary">
            {Math.round(((activeIndex + 1) / WORKFLOW_STAGES.length) * 100)}% Complete
          </span>
        </div>

        <div className="flex items-center overflow-x-auto py-1 space-x-1 sm:space-x-1.5 scrollbar-none">
          {WORKFLOW_STAGES.map((stage, idx) => {
            const isDone = idx < activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <React.Fragment key={stage.key}>
                <button
                  type="button"
                  onClick={() => onStepClick?.(stage, idx)}
                  disabled={!onStepClick}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isCurrent
                      ? 'bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20 scale-[1.02]'
                      : isDone
                      ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                      : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                  } ${!onStepClick ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                  ) : isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-primary-foreground shrink-0 animate-pulse" />
                  ) : (
                    <Circle className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                  )}
                  <span>{stage.shortLabel || stage.label}</span>
                </button>

                {idx < WORKFLOW_STAGES.length - 1 && (
                  <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}
