'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { LifeQuoteWizard } from '../../../../components/life-quote/LifeQuoteWizard';

function NewLifeQuotation() {
  const params = useSearchParams();
  const contactId = params.get('contactId') ?? undefined;
  const customerId = params.get('customerId') ?? undefined;
  const leadId = params.get('leadId') ?? undefined;
  const targetId = contactId || customerId;

  return <LifeQuoteWizard contactId={targetId} leadId={leadId} />;
}

export default function NewLifeQuotationPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading Life Proposal Wizard...</div>}>
        <NewLifeQuotation />
      </Suspense>
    </AppShell>
  );
}

