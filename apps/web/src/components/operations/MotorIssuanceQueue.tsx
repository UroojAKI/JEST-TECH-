'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../lib/api-client';
import { UpdatePolicyDetailsDialog } from '../leads/motor-quote/UpdatePolicyDetailsDialog';

type QueueQuote = {
  id: string;
  quotationCode: string;
  insurerName?: string;
  totalPremium: number;
  registrationNumber?: string;
  policyType?: string;
  workflowState?: string;
  issuanceStatus?: string;
  proposerDetails?: { customerName?: string };
};

export function MotorIssuanceQueue() {
  const [quotes, setQuotes] = useState<QueueQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/quotations', { params: { productType: 'MOTOR', limit: 100 } });
      const list = res.data?.data || res.data?.items || res.data || [];
      const mapped = (Array.isArray(list) ? list : [])
        .filter((q: any) => q.productType === 'MOTOR' && q.workflowState === 'PAYMENT_DONE' && q.issuanceStatus === 'ISSUANCE_PENDING')
        .map((q: any) => ({
          id: q.id,
          quotationCode: q.quotationCode,
          insurerName: q.insurerName,
          totalPremium: Number(q.totalPremium || 0),
          registrationNumber: q.registrationNumber,
          policyType: q.policyType,
          workflowState: q.workflowState,
          issuanceStatus: q.issuanceStatus,
          proposerDetails: q.motorMetadata?.proposerDetails,
        }));
      setQuotes(mapped);
    } catch (error) {
      console.error(error);
      toast.error('Unable to load the Motor issuance queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadQueue(); }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Motor Policy Issuance</h1>
          <p className="text-sm text-muted-foreground">Only payment-confirmed Motor quotations are available for Back Office issuance.</p>
        </div>
        <button onClick={() => void loadQueue()} disabled={loading} className="p-2 rounded-md border hover:bg-muted">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </button>
      </div>

      {quotes.length === 0 && !loading ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <ShieldCheck className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
          <p className="font-medium">No Motor policies are waiting for issuance.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="rounded-xl border bg-card p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{quote.proposerDetails?.customerName || 'Customer'}</span>
                  <span className="text-xs rounded-full bg-amber-500/10 text-amber-700 px-2 py-1">PAYMENT DONE</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">{quote.quotationCode} · {quote.registrationNumber || 'New Vehicle'} · {quote.policyType || 'Motor'} · {quote.insurerName || 'Insurer'}</div>
                <div className="text-sm font-semibold mt-2">₹{quote.totalPremium.toLocaleString('en-IN')}</div>
              </div>
              <button onClick={() => setSelectedQuote(quote.id)} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4" />Enter Issued Policy Details
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedQuote && (
        <UpdatePolicyDetailsDialog
          isOpen={Boolean(selectedQuote)}
          quotationId={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onSaved={() => { setSelectedQuote(null); toast.success('Motor policy issued successfully'); void loadQueue(); }}
        />
      )}
    </div>
  );
}
