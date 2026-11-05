'use client';

import React, { Suspense } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { LifeQuotationsWorkspace } from '../../../components/sales/LifeQuotationsWorkspace';

export default function LifeQuotationsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">Loading Life Insurance Proposals...</div>}>
        <LifeQuotationsWorkspace />
      </Suspense>
    </AppShell>
  );
}

