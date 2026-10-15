'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LeadHeader } from '../../../../components/leads/lead-header';
import { LeadTabsContainer } from '../../../../components/leads/tabs/LeadTabsContainer';
import { MarkLostModal } from '../../../../components/leads/drawers/MarkLostModal';
import { LeadConvertWizardDrawer } from '../../../../components/leads/drawers/LeadConvertWizardDrawer';
import { useLeads, useLeadWorkspace } from '../../../../hooks/useLeads';

import { WorkflowProgressHeader, WorkflowStageKey } from '../../../../components/workflow/WorkflowProgressHeader';

export default function LeadWorkspacePage() {
  const params = useParams();
  const leadId = (params?.id as string) || '';

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const { leads, markLost, isUpdating } = useLeads();
  const { lead: workspaceLead, isLoading } = useLeadWorkspace(leadId);

  // Find matching lead in workspace API or leads list
  const foundHookLead = (leads || []).find((l: any) => l.id === leadId || l.leadCode === leadId);
  const rawLead = workspaceLead || foundHookLead;

  const resolvedContact = rawLead?.contact || rawLead?.lead?.contact || null;
  const leadData = {
    id: rawLead?.id || rawLead?.leadId || leadId,
    code: rawLead?.leadCode || rawLead?.code || leadId,
    name: rawLead?.name || resolvedContact?.fullName || `${resolvedContact?.firstName || rawLead?.firstName || ''} ${resolvedContact?.lastName || rawLead?.lastName || ''}`.trim() || (leadId ? `Lead (${leadId})` : 'Lead Workspace'),
    firstName: resolvedContact?.firstName || rawLead?.firstName || '',
    lastName: resolvedContact?.lastName || rawLead?.lastName || '',
    contact: resolvedContact,
    phone: resolvedContact?.phone || rawLead?.phone || '',
    email: resolvedContact?.email || rawLead?.email || '',
    productInterest: rawLead?.productInterest || rawLead?.product || null,
    expectedPremium: rawLead?.estimatedPremium ?? rawLead?.expectedPremium ?? null,
    score: rawLead?.score ?? null,
    probabilityScore: rawLead?.probabilityScore ?? null,
    priority: rawLead?.priority ?? null,
    source: rawLead?.source ?? null,
    agent: rawLead?.assignedTo
      ? [rawLead.assignedTo.firstName, rawLead.assignedTo.lastName].filter(Boolean).join(' ') || rawLead.assignedTo.email
      : rawLead?.assignedAgentName || rawLead?.agent || null,
    duplicateWarning: rawLead?.duplicateWarning ?? false,
    status: rawLead?.status || 'NEW',
    createdAt: rawLead?.createdAt ?? null,
    updatedAt: rawLead?.updatedAt ?? null,
    currentWorkflowStep: rawLead?.currentWorkflowStep ?? null,
    firstResponseAt: rawLead?.firstResponseAt ?? null,
    firstResponseDueAt: rawLead?.firstResponseDueAt ?? null,
    slaStatus: rawLead?.slaStatus ?? null,
    nextFollowup: rawLead?.nextFollowup ?? null,
    nextAction: rawLead?.nextAction ?? null,
    pendingDocuments: rawLead?.pendingDocuments ?? rawLead?.missingDocuments ?? null,
    expectedCloseDate: rawLead?.expectedCloseDate ?? rawLead?.expectedCloseAt ?? null,
  };

  const handleConfirmLost = (reason: any, competitor?: string, priceDiff?: number, remarks?: string) => {
    markLost(
      { id: leadId, reason, competitor, priceDiff, remarks },
      {
        onSuccess: () => {
          setIsMarkLostOpen(false);
        },
      }
    );
  };

  const getWorkflowStage = (status: any): WorkflowStageKey => {
    const statusString = typeof status === 'object' && status !== null ? status.status || status.value || 'NEW' : status || 'NEW';
    const s = String(statusString).toUpperCase();
    if (['NEW'].includes(s)) return 'lead';
    if (['CONTACTED'].includes(s)) return 'contacted';
    if (['QUALIFIED'].includes(s)) return 'qualified';
    if (['QUOTE_PREPARED', 'PROPOSAL_SENT', 'PAYMENT_PENDING'].includes(s)) return 'quotation';
    if (['CONVERTED'].includes(s)) return 'policy';
    return 'lead';
  };

  return (
    <AppShell>
      <div className="space-y-5">
        {/* 0. Universal Sales Workflow Stepper */}
        <WorkflowProgressHeader
          currentStep={getWorkflowStage(leadData.status)}
          status={leadData.status}
          title={leadData.name}
          subtitle={`Lead #${leadData.code} • ${leadData.productInterest}`}
          backHref="/crm/leads"
          backLabel="All Leads"
          nextAction={
            leadData.status === 'CONVERTED'
              ? {
                  label: 'View Customer',
                  href: `/crm/contacts?search=${encodeURIComponent(leadData.name)}`,
                  variant: 'success',
                }
              : {
                  label: 'Create Quotation',
                  href: `/sales/quotations?create=1&leadId=${leadId}`,
                  variant: 'primary',
                }
          }
        />

        {/* 1. Dynamic Lead Header */}
        <LeadHeader
          lead={leadData}
          onLaunchConvert={() => setIsConvertOpen(true)}
          onLaunchMarkLost={() => setIsMarkLostOpen(true)}
        />

      {/* 2. 9 Workspace Tabs Container */}
      <LeadTabsContainer
        leadId={leadId}
        leadContact={{
          name: leadData.name,
          phone: leadData.phone,
          email: leadData.email,
          rm: leadData.agent,
        }}
      />

      {/* 3. Mark Lost Modal */}
      <MarkLostModal
        isOpen={isMarkLostOpen}
        onClose={() => setIsMarkLostOpen(false)}
        onSubmit={handleConfirmLost}
        isSubmitting={isUpdating}
      />

      {/* 4. 4-Stage Lead Conversion Wizard Drawer */}
      <LeadConvertWizardDrawer
        isOpen={isConvertOpen}
        leadId={leadId}
        lead={leadData}
        onClose={() => setIsConvertOpen(false)}
      />
      </div>
    </AppShell>
  );
}
