'use client';

import React from 'react';
import { HeartPulse, CheckCircle2, ChevronRight } from 'lucide-react';

interface CustomerHealthStepperProps {
  workspace?: any;
}

export function CustomerHealthStepper({ workspace }: CustomerHealthStepperProps) {
  const policies = workspace?.policies || [];
  const claims = workspace?.claims || [];
  const quotations = workspace?.quotations || [];
  const analytics = workspace?.analytics || {};

  const totalPremiumPaid =
    Number(analytics.totalPremiumPaid) ||
    policies.reduce((sum: number, p: any) => sum + Number(p.premiumAmount || 0), 0);

  const totalClaimsSettled =
    Number(analytics.totalClaimsSettled) ||
    claims
      .filter((c: any) => c.status === 'SETTLED')
      .reduce((sum: number, c: any) => sum + Number(c.approvedAmount || c.claimAmount || 0), 0);

  const activePolicies = policies.filter((p: any) =>
    ['ACTIVE', 'ISSUED', 'RENEWED'].includes(p.status),
  );
  const openClaims = claims.filter(
    (c: any) => !['SETTLED', 'CLOSED', 'REJECTED'].includes(c.status),
  );

  // Dynamic Metrics
  const claimsRatioNum =
    totalPremiumPaid > 0 ? (totalClaimsSettled / totalPremiumPaid) * 100 : 0;
  const claimsRatioStr = `${claimsRatioNum.toFixed(1)}%`;

  const ltvFormatted =
    totalPremiumPaid >= 100000
      ? `₹${(totalPremiumPaid / 100000).toFixed(2)}L`
      : `₹${totalPremiumPaid.toLocaleString('en-IN')}`;

  const renewalProbStr =
    activePolicies.length > 0
      ? `${analytics.renewalProbability || (openClaims.length > 0 ? 75 : 95)}%`
      : '—';

  // Health score calculation
  let computedHealth = analytics.healthScore || 100;
  if (!analytics.healthScore) {
    if (openClaims.length > 0) computedHealth -= openClaims.length * 10;
    if (policies.some((p: any) => p.status === 'LAPSED')) computedHealth -= 15;
    if (activePolicies.length > 1) computedHealth = Math.min(100, computedHealth + 5);
    computedHealth = Math.max(20, Math.min(100, computedHealth));
  }

  const healthScore = computedHealth;
  const healthLabel =
    healthScore >= 85 ? 'Excellent' : healthScore >= 65 ? 'Good' : 'Needs Review';
  const healthBadgeColor =
    healthScore >= 85
      ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
      : healthScore >= 65
      ? 'text-amber-600 bg-amber-500/10 border-amber-500/20'
      : 'text-rose-600 bg-rose-500/10 border-rose-500/20';

  const riskScoreText =
    claimsRatioNum <= 25
      ? `Low (${Math.min(25, Math.round(claimsRatioNum))}/100)`
      : claimsRatioNum <= 60
      ? `Moderate (${Math.round(claimsRatioNum)}/100)`
      : `High (${Math.min(100, Math.round(claimsRatioNum))}/100)`;

  // Dynamic Lifecycle Stages
  const isLeadDone = true; // Customer is registered in system
  const isQuoteDone = quotations.length > 0 || policies.length > 0;
  const isProposalDone =
    policies.length > 0 || quotations.some((q: any) => ['ACCEPTED', 'CONVERTED'].includes(q.status));
  const isPolicyActiveDone = activePolicies.length > 0;
  const isRenewalDone = policies.some(
    (p: any) => p.status === 'RENEWED' || (p.renewals && p.renewals.length > 0),
  );
  const isClaimDone = claims.length > 0;
  const isRetentionDone =
    policies.length >= 2 || policies.some((p: any) => p.status === 'RENEWED');

  // Determine current active milestone
  let currentStageIndex = 0;
  if (isRetentionDone) {
    currentStageIndex = 6;
  } else if (openClaims.length > 0 || isClaimDone) {
    currentStageIndex = 5;
  } else if (isRenewalDone || policies.some((p: any) => {
    if (!p.expiryDate) return false;
    const diffDays = Math.ceil((new Date(p.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays <= 45;
  })) {
    currentStageIndex = 4;
  } else if (isPolicyActiveDone) {
    currentStageIndex = 3;
  } else if (isProposalDone) {
    currentStageIndex = 2;
  } else if (isQuoteDone) {
    currentStageIndex = 1;
  } else {
    currentStageIndex = 0;
  }

  const journeyStages = [
    { label: 'Lead', completed: isLeadDone, current: currentStageIndex === 0 },
    { label: 'Quote', completed: isQuoteDone, current: currentStageIndex === 1 },
    { label: 'Proposal', completed: isProposalDone, current: currentStageIndex === 2 },
    { label: 'Policy Active', completed: isPolicyActiveDone, current: currentStageIndex === 3 },
    { label: 'Renewal', completed: isRenewalDone, current: currentStageIndex === 4 },
    { label: 'Claim Filed', completed: isClaimDone, current: currentStageIndex === 5 },
    { label: 'Retention', completed: isRetentionDone, current: currentStageIndex === 6 },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* Customer Health Score Widget */}
      <div className="lg:col-span-4 rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <div className="flex justify-between items-center border-b pb-2">
          <div className="flex items-center space-x-2">
            <HeartPulse className="h-4 w-4 text-emerald-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Customer Health Gauge</h3>
          </div>
          <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${healthBadgeColor}`}>
            {healthScore} / 100 • {healthLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Renewal Probability</span>
            <div className="font-bold text-foreground">{renewalProbStr}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Claims Ratio</span>
            <div className={`font-bold ${claimsRatioNum > 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {claimsRatioStr}
            </div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Lifetime Value (LTV)</span>
            <div className="font-bold text-foreground">{ltvFormatted}</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/20 border space-y-0.5">
            <span className="text-[10px] text-muted-foreground">Risk Score</span>
            <div className={`font-bold ${claimsRatioNum > 50 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {riskScoreText}
            </div>
          </div>
        </div>
      </div>

      {/* Customer Journey Progress Stepper */}
      <div className="lg:col-span-8 rounded-xl border bg-card p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider border-b pb-2">Customer Lifecycle Journey</h3>
        <div className="flex items-center justify-between overflow-x-auto py-2">
          {journeyStages.map((stage, idx) => (
            <React.Fragment key={stage.label}>
              <div className="flex flex-col items-center text-center space-y-1 min-w-[70px]">
                <div
                  className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    stage.current
                      ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/40'
                      : stage.completed
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {stage.completed ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                </div>
                <span
                  className={`text-[10px] font-semibold ${
                    stage.current ? 'text-primary font-bold' : 'text-muted-foreground'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {idx < journeyStages.length - 1 && (
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
