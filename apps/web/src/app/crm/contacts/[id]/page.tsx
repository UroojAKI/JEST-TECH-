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

export default function CustomerWorkspacePage() {
  const params = useParams();
  const customerId = (params?.id as string) || 'CUST-001928';
  const { setActiveCustomer } = useCustomerContext();
  const [activeWizard, setActiveWizard] = useState<string | null>(null);

  useEffect(() => {
    setActiveCustomer(customerId, 'Acme Logistics Pvt Ltd', 'CORPORATE');
  }, [customerId, setActiveCustomer]);

  const customerData = {
    id: customerId,
    name: 'Acme Logistics Pvt Ltd',
    type: 'CORPORATE',
    phone: '+91 98765 43210',
    email: 'contact@acme.com',
    pan: 'ABCDE1234F',
    gst: '27AAAAA0000A1Z5',
    address: 'BKC, Mumbai 400051',
    agent: 'Rajesh Sharma',
    branch: 'Mumbai HQ',
  };

  return (
    <AppShell>
      {/* 1. Customer Header */}
      <CustomerHeader
        customer={customerData}
        onLaunchWizard={(type) => setActiveWizard(type)}
      />

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
