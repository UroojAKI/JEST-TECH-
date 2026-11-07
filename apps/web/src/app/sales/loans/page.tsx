'use client';

import React, { Suspense } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { LoansWorkspace } from '../../../components/loans/LoansWorkspace';

export default function LoansPage() {
  return (
    <AppShell>
      <Suspense
        fallback={
          <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">
            Loading Loans & Mortgage Pipeline...
          </div>
        }
      >
        <LoansWorkspace />
      </Suspense>
    </AppShell>
  );
}

