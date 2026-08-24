'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LeadHeader } from '../../../../components/leads/lead-header';
import { LeadTabsContainer } from '../../../../components/leads/tabs/LeadTabsContainer';
import { MarkLostModal } from '../../../../components/leads/drawers/MarkLostModal';
import { LeadConvertWizardDrawer } from '../../../../components/leads/drawers/LeadConvertWizardDrawer';
import { useLeads, useLeadWorkspace } from '../../../../hooks/useLeads';

export default function LeadWorkspacePage() {
  const params = useParams();
  const leadId = (params?.id as string) || '';

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const { leads, markLost } = useLeads();
  const { lead: workspaceLead, isLoading } = useLeadWorkspace(leadId);

  // Find matching lead in workspace API or leads list
  const foundHookLead = (leads || []).find((l: any) => l.id === leadId || l.leadCode === leadId);
  const rawLead = workspaceLead || foundHookLead;

  const leadData = {
    id: leadId,
    code: rawLead?.leadCode || leadId,
    name: rawLead ? `${rawLead.firstName || ''} ${rawLead.lastName || ''}`.trim() : (leadId ? `Lead (${leadId})` : 'Lead Workspace'),
    firstName: rawLead?.firstName || '',
    lastName: rawLead?.lastName || '',
    phone: rawLead?.phone || '',
    email: rawLead?.email || '',
    productInterest: rawLead?.productInterest || 'Motor Comprehensive',
    expectedPremium: rawLead?.expectedPremium || 0,
    priority: rawLead?.priority || 'WARM',
    source: rawLead?.source || 'WEBSITE',
    agent: rawLead?.assignedAgentName || 'Sales Agent',
    duplicateWarning: rawLead?.duplicateWarning ?? false,
    status: rawLead?.status || 'NEW',
  };

  const handleConfirmLost = (reason: any, competitor?: string, priceDiff?: number, remarks?: string) => {
    markLost({ id: leadId, reason, competitor, priceDiff, remarks });
  };

  return (
    <AppShell>
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
      />

      {/* 4. 4-Stage Lead Conversion Wizard Drawer */}
      <LeadConvertWizardDrawer
        isOpen={isConvertOpen}
        leadId={leadId}
        lead={leadData}
        onClose={() => setIsConvertOpen(false)}
      />
    </AppShell>
  );
}
