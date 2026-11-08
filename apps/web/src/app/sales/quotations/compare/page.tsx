'use client';

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { AppShell } from '../../../../components/layout/app-shell';
import { apiClient } from '../../../../lib/api-client';
import { AlertCircle, ArrowLeft, GitCompareArrows, Loader2, Search } from 'lucide-react';

type Quote = {
  id: string;
  quotationCode: string;
  title: string;
  insurerName: string;
  productType: string;
  sumInsured: number;
  totalPremium: number;
  status: string;
  expiryDate: string;
  caseId?: string | null;
};

export default function QuoteComparisonPage() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [comparison, setComparison] = useState<Quote[] | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  const [compareError, setCompareError] = useState('');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['saved-quotations-for-comparison'],
    queryFn: async () => {
      const response = await apiClient.get('/quotations', {
        params: { page: 1, limit: 100, sortBy: 'createdAt', sortOrder: 'desc' },
      });
      const payload = response.data;
      return (payload?.items || payload?.data || []) as Quote[];
    },
  });

  const quotes = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data || []).filter((quote) =>
      !term ||
      [quote.quotationCode, quote.title, quote.insurerName, quote.productType]
        .some((value) => String(value || '').toLowerCase().includes(term)),
    );
  }, [data, search]);

  const toggleQuote = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 6
          ? [...current, id]
          : current,
    );
    setComparison(null);
    setCompareError('');
  };

  const compareSavedQuotes = async () => {
    if (selectedIds.length < 2) return;
    setIsComparing(true);
    setCompareError('');
    try {
      // Read-only comparison of persisted quotation IDs. This endpoint does not
      // create, clone, revise or submit quotations.
      const response = await apiClient.post('/quotations/compare', { ids: selectedIds });
      const items = response.data?.items || [];
      setComparison(items);
      if (items.length !== selectedIds.length) {
        setCompareError('The comparison returned an unexpected number of saved quotations. Refresh and verify access.');
      }
    } catch (error: any) {
      setCompareError(error?.response?.data?.message || 'Unable to compare the selected saved quotations.');
      setComparison(null);
    } finally {
      setIsComparing(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/sales/quotations" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to quotations
            </Link>
            <h1 className="mt-2 text-2xl font-black">Compare saved quotations</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Select quotations already generated for the same customer or case. Comparison is read-only and never creates another quotation.
            </p>
          </div>
          <div className="rounded-xl border bg-card px-4 py-3 text-xs text-muted-foreground">
            {selectedIds.length} selected · maximum 6
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search quotation, insurer or product" className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-sm" />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading saved quotations…</div>
          ) : isError ? (
            <div className="flex items-center justify-between gap-3 py-8 text-sm text-destructive"><span>Could not load saved quotations.</span><button onClick={() => refetch()} className="rounded-lg border px-3 py-2">Retry</button></div>
          ) : quotes.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No saved quotations found.</div>
          ) : (
            <div className="divide-y">
              {quotes.map((quote) => (
                <label key={quote.id} className="flex cursor-pointer items-center gap-3 py-3">
                  <input type="checkbox" checked={selectedIds.includes(quote.id)} onChange={() => toggleQuote(quote.id)} disabled={!selectedIds.includes(quote.id) && selectedIds.length >= 6} className="h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                      <span>{quote.insurerName}</span>
                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-semibold">{quote.productType}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{quote.quotationCode} · {quote.title}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">₹{Number(quote.totalPremium || 0).toLocaleString('en-IN')}</div>
                    <div className="text-[10px] text-muted-foreground">{quote.status}</div>
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex justify-end border-t pt-3">
            <button onClick={compareSavedQuotes} disabled={selectedIds.length < 2 || isComparing} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40">
              {isComparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />}
              Compare selected quotations
            </button>
          </div>
        </div>

        {compareError && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{compareError}</div>}

        {comparison && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h2 className="font-bold">Comparison result · {comparison.length} saved quotations</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead><tr className="border-b text-xs text-muted-foreground"><th className="p-2">Insurer</th><th className="p-2">Quotation</th><th className="p-2">Product</th><th className="p-2 text-right">Sum insured</th><th className="p-2 text-right">Total premium</th><th className="p-2">Status</th></tr></thead>
                <tbody>
                  {comparison.map((quote) => (
                    <tr key={quote.id} className="border-b last:border-0">
                      <td className="p-2 font-semibold">{quote.insurerName}</td>
                      <td className="p-2 font-mono text-xs">{quote.quotationCode}</td>
                      <td className="p-2">{quote.productType}</td>
                      <td className="p-2 text-right">₹{Number(quote.sumInsured || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2 text-right font-bold">₹{Number(quote.totalPremium || 0).toLocaleString('en-IN')}</td>
                      <td className="p-2">{quote.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">These are existing quotation records. No new quotation or back-office task was created by comparing them.</p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
