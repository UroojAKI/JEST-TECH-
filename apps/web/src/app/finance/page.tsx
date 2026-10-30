'use client';

import React from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { FinanceOperationsHub } from '../../components/finance/FinanceOperationsHub';

/**
 * Backward compatibility wrapper for /finance.
 * The canonical finance workspace is at /workspace/finance.
 */
export default function FinanceOperationsHubPage() {
  return (
    <AppShell>
      <FinanceOperationsHub />
    </AppShell>
  );
}
