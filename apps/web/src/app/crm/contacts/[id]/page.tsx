'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { CustomerHeader } from '../../../../components/customer/customer-header';
import { CustomerAlertsQueue } from '../../../../components/customer/customer-alerts-queue';
import { CustomerHealthStepper } from '../../../../components/customer/customer-health-stepper';
import { CustomerTabsContainer } from '../../../../components/customer/tabs/CustomerTabsContainer';
import { SideWizardDrawer } from '../../../../components/customer/wizards/side-wizard-drawer';
import { useCustomerContext } from '../../../../store/customer-context';
import { useCustomerWorkspace } from '../../../../hooks/useCustomer360';

export default function CustomerWorkspacePage() {
  const params = useParams();
  const customerId = (params?.id as string) || '';
  const { setActiveCustomer } = useCustomerContext();
  const [activeWizard, setActiveWizard] = useState<string | null>(null);

  const { workspace, isLoading, isError } = useCustomerWorkspace(customerId);

  const contact = workspace?.contact || workspace;

  const customerName = contact
    ? contact.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || `Customer (${customerId})`
    : `Customer (${customerId})`;

  const customerType = contact?.type || 'INDIVIDUAL';

  useEffect(() => {
    if (customerId && customerName) {
      setActiveCustomer(customerId, customerName, customerType);
    }
  }, [customerId, customerName, customerType, setActiveCustomer]);

  const customerData = {
    id: customerId,
    name: customerName,
    type: customerType,
    phone: contact?.phone || '-',
    email: contact?.email || '-',
    pan: contact?.panNumber || contact?.pan || 'XXXXX1234F',
    gst: contact?.gstNumber || contact?.gst || 'N/A',
    address: contact?.address || 'Mumbai, Maharashtra',
    agent: typeof contact?.agent === 'object' ? (contact.agent?.name || contact.agent?.firstName || 'Assigned Agent') : (contact?.assignedAgentName || contact?.agent || 'Assigned Agent'),
    branch: typeof contact?.branch === 'object' ? (contact.branch?.name || contact.branch?.code || 'Main Branch') : (contact?.branchName || contact?.branch || 'Main Branch'),
  };

  return (
    <AppShell>
      {/* 1. Customer Header */}
      {isLoading ? (
        <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Customer 360 Workspace from API...</div>
      ) : isError ? (
        <div className="p-8 text-center text-xs text-red-500">Failed to load customer workspace.</div>
      ) : (
        <CustomerHeader
          customer={customerData}
          onLaunchWizard={(type) => setActiveWizard(type)}
        />
      )}

      {/* 2. Active Alerts & Workspace Tasks Queue */}
      <CustomerAlertsQueue />

      {/* 3. Customer Health Gauge & Journey Progress */}
      <CustomerHealthStepper />

      {/* 4. 15-Tabbed Workspace Container */}
      <CustomerTabsContainer customerId={customerId} />

      {/* 5. Slide-Over Action Wizard Drawer */}
      <SideWizardDrawer
        type={activeWizard}
        customerId={customerId}
        onClose={() => setActiveWizard(null)}
      />
    </AppShell>
  );
}
