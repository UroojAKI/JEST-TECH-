'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { HealthCaseWorkspace } from '../../../../components/health-quote/HealthCaseWorkspace';

export default function HealthQuotationCasePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <HealthCaseWorkspace caseId={id} />
    </AppShell>
  );
}
