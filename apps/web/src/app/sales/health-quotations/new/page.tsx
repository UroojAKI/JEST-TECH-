'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import { HealthQuoteWizard } from '../../../../components/health-quote/HealthQuoteWizard';

function NewHealthQuotation() {
  const params = useSearchParams();
  const contactId = params.get('contactId') ?? '';
  const leadId = params.get('leadId') ?? undefined;

  if (!contactId) {
    return (
      <div className="p-8 text-center text-xs text-muted-foreground">
        Open the Health quotation from a customer (+ Create Quote) or a lead.
      </div>
    );
  }
  return <HealthQuoteWizard contactId={contactId} leadId={leadId} />;
}

export default function NewHealthQuotationPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="p-8 text-center text-xs text-muted-foreground animate-pulse">Loading...</div>}>
        <NewHealthQuotation />
      </Suspense>
    </AppShell>
  );
}
