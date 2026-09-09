'use client';

import React, { Suspense } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { MotorQuotationsWorkspace } from '../../../components/sales/MotorQuotationsWorkspace';

export default function QuotationsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading Motor Quotations Workspace...</div>}>
        <MotorQuotationsWorkspace />
      </Suspense>
    </AppShell>
  );
}
