'use client';

import React, { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function NewQuotationRedirector() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams(searchParams?.toString() || '');
    if (!params.get('openQuote')) {
      params.set('openQuote', '1');
    }
    router.replace(`/sales/quotations?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <p className="text-xs font-semibold text-muted-foreground animate-pulse">
        Opening Motor Quotation Form...
      </p>
    </div>
  );
}

export default function NewMotorQuotePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs font-semibold text-muted-foreground">Loading Quotation Form...</p>
        </div>
      }
    >
      <NewQuotationRedirector />
    </Suspense>
  );
}
