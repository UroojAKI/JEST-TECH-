'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LeadHeader } from '../../../../components/leads/lead-header';
import { LeadTabsContainer } from '../../../../components/leads/tabs/LeadTabsContainer';
import { MarkLostModal } from '../../../../components/leads/drawers/MarkLostModal';
import { LeadConvertWizardDrawer } from '../../../../components/leads/drawers/LeadConvertWizardDrawer';
import { useLeads } from '../../../../hooks/useLeads';

export default function LeadWorkspacePage() {
  const params = useParams();
  const leadId = (params?.id as string) || 'LD-00912';

  const [isMarkLostOpen, setIsMarkLostOpen] = useState(false);
  const [isConvertOpen, setIsConvertOpen] = useState(false);

  const { markLost } = useLeads();

  const leadData = {
    id: leadId,
    code: leadId,
    name: 'Rahul Patil',
    agent: 'Rajesh Sharma',
    duplicateWarning: true,
  };

  const handleConfirmLost = (reason: any, competitor?: string, priceDiff?: number, remarks?: string) => {
    markLost({ id: leadId, reason, competitor, priceDiff, remarks });
  };

  return (
    <AppShell>
      {/* 1. Lead Header, Duplicate Warning & SLA Panel */}
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
        onClose={() => setIsConvertOpen(false)}
      />
    </AppShell>
  );
}
