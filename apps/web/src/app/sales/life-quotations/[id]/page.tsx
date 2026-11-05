'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LifeCaseWorkspace } from '../../../../components/life-quote/LifeCaseWorkspace';

export default function LifeQuotationCasePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <AppShell>
      <LifeCaseWorkspace caseId={id} />
    </AppShell>
  );
}

