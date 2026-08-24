'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { MotorQuotationsWorkspace } from '../../../components/sales/MotorQuotationsWorkspace';

export default function QuotationsPage() {
  return (
    <AppShell>
      <MotorQuotationsWorkspace />
    </AppShell>
  );
}
