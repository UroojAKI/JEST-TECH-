'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LeadHeader } from '../../../../components/leads/lead-header';
import { LeadTabsContainer } from '../../../../components/leads/tabs/LeadTabsContainer';
import { MarkLostModal } from '../../../../components/leads/drawers/MarkLostModal';
import { LeadConvertWizardDrawer } from '../../../../components/leads/drawers/LeadConvertWizardDrawer';
import { useLeads, useLeadWorkspace } from '../../../../hooks/useLeads';

const STORAGE_KEY = 'jest_crm_leads_v3';

export default function LeadWorkspacePage() {
  const params = useParams();
  const leadId = (params?.id as string) || 'LD-00912';

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const { leads, markLost } = useLeads();
  const { lead: workspaceLead } = useLeadWorkspace(leadId);

  const [localLead, setLocalLead] = useState<any>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const match = parsed.find((l: any) => l.id === leadId || l.leadCode === leadId);
        if (match) {
          setLocalLead(match);
        }
      }
    } catch (e) {
      // ignore
    }
  }, [leadId]);

  // Find matching lead in localLead, hook state, or workspace API
  const foundHookLead = (leads || []).find((l: any) => l.id === leadId || l.leadCode === leadId);
  const rawLead = localLead || workspaceLead || foundHookLead;

  const leadData = {
    id: leadId,
    code: rawLead?.leadCode || leadId,
    name: rawLead ? `${rawLead.firstName || ''} ${rawLead.lastName || ''}`.trim() : `Lead Prospect (${leadId})`,
    firstName: rawLead?.firstName || 'Prospect',
    lastName: rawLead?.lastName || leadId,
    phone: rawLead?.phone || '+91 98765 43210',
    email: rawLead?.email || 'prospect@gmail.com',
    productInterest: rawLead?.productInterest || 'Motor Comprehensive',
    expectedPremium: rawLead?.expectedPremium || 25000,
    priority: rawLead?.priority || 'HOT',
    source: rawLead?.source || 'WEBSITE',
    agent: rawLead?.assignedAgentName || 'Rajesh Sharma',
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
      <LeadTabsContainer leadId={leadId} />

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
