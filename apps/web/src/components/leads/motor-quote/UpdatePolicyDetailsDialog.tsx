'use client';

import React, { useState, useEffect } from 'react';
import { X, CheckCircle, Upload, ShieldCheck, CreditCard, UserCheck, AlertCircle } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  onSaved: () => void;
}

export function UpdatePolicyDetailsDialog({ isOpen, onClose, quotationId, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [quoteDetails, setQuoteDetails] = useState<any>(null);

  const [actualPolicyNumber, setActualPolicyNumber] = useState('');
  const [actualPremium, setActualPremium] = useState('');
  const [customerPan, setCustomerPan] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmPaymentReceived, setConfirmPaymentReceived] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [odStartDate, setOdStartDate] = useState('');
  const [odExpiryDate, setOdExpiryDate] = useState('');
  const [tpStartDate, setTpStartDate] = useState('');
  const [tpExpiryDate, setTpExpiryDate] = useState('');
  const [policyPdf, setPolicyPdf] = useState<File | null>(null);

  useEffect(() => {
    if (!isOpen || !quotationId) return;
    let isMounted = true;
    setFetchingQuote(true);

    apiClient
      .get(`/quotations/${quotationId}`)
      .then((res) => {
        if (!isMounted) return;
        const q = res.data;
        setQuoteDetails(q);
        const totalPrem =
          q.totalPremium ??
          q.calculationSnapshot?.outputs?.totalPremium ??
          '';
        if (totalPrem && !actualPremium) {
          setActualPremium(String(totalPrem));
        }
        const fetchedPan =
          q.contact?.panNumber ||
          (q.motorMetadata as any)?.proposerDetails?.panNumber ||
          q.proposerDetails?.panNumber ||
          '';
        if (fetchedPan && !customerPan) {
          setCustomerPan(fetchedPan);
        }
        if (q.motorPaymentRecord?.referenceNumber && !paymentReference) {
          setPaymentReference(q.motorPaymentRecord.referenceNumber);
        }

        // Set default dates if empty
        if (!startDate) {
          const today = new Date().toISOString().split('T')[0];
          setStartDate(today);
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          nextYear.setDate(nextYear.getDate() - 1);
          setEndDate(nextYear.toISOString().split('T')[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to pre-fetch quotation details', err);
      })
      .finally(() => {
        if (isMounted) setFetchingQuote(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, quotationId]);

  if (!isOpen) return null;

  const netPayable =
    quoteDetails?.basePremium ??
    quoteDetails?.calculationSnapshot?.outputs?.netCustomerPremium ??
    quoteDetails?.calculationSnapshot?.outputs?.basePremium ??
    (quoteDetails?.totalPremium !== undefined && quoteDetails?.gstAmount !== undefined
      ? Number(quoteDetails.totalPremium) - Number(quoteDetails.gstAmount)
      : quoteDetails?.totalPremium ?? 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let documentFields: Record<string, unknown> = {};
      if (policyPdf) {
        const formData = new FormData();
        formData.append('file', policyPdf);
        formData.append('name', `Issued Motor Policy - ${actualPolicyNumber}`);
        formData.append('entityType', 'QUOTATION');
        formData.append('entityId', quotationId);
        formData.append('category', 'MOTOR_POLICY_SCHEDULE');
        formData.append('tags', 'motor,policy,issued');

        const upload = await apiClient.post('/documents/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const storageKey = upload.data?.storageKey;
        if (!storageKey) throw new Error('Policy document upload did not return a storage key');
        documentFields = {
          documentFileKey: storageKey,
          documentFileName: policyPdf.name,
          documentFileSize: policyPdf.size,
        };
      }

      await apiClient.post(`/motor/quotes/${quotationId}/issue`, {
        actualPolicyNumber: actualPolicyNumber.trim(),
        actualPremium: parseFloat(actualPremium),
        customerPan: customerPan.trim() || undefined,
        paymentReference: paymentReference.trim() || undefined,
        confirmPaymentReceived,
        startDate,
        endDate,
        odStartDate: odStartDate || undefined,
        odExpiryDate: odExpiryDate || undefined,
        tpStartDate: tpStartDate || undefined,
        tpExpiryDate: tpExpiryDate || undefined,
        ...documentFields,
      });

      onSaved();
    } catch (error: any) {
      console.error(error);
      const serverMsg = error?.response?.data?.message;
      const blockers = error?.response?.data?.blockers;
      const displayMsg =
        serverMsg ||
        (Array.isArray(blockers) && blockers.length
          ? `Policy issuance blocked: ${blockers.join(', ')}`
          : null) ||
        error?.message ||
        'Unable to issue policy. Please verify the quotation and payment state.';
      alert(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <div>
            <h3 className="font-bold text-base text-foreground">Manual Policy Issuance & Entry</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Back Office Underwriting Authority · Section 64VB Compliant
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {quoteDetails && (
            <div className="bg-muted/40 border rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="font-mono font-bold text-foreground">
                  {quoteDetails.quotationCode}
                </span>
                <span className="text-muted-foreground ml-2">
                  • {quoteDetails.contact?.firstName} {quoteDetails.contact?.lastName || ''}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground mr-1">Net Payable:</span>
                <span className="font-mono font-bold text-emerald-600">
                  ₹{Number(netPayable || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Actual Policy Number *</label>
              <input
                required
                type="text"
                value={actualPolicyNumber}
                onChange={(e) => setActualPolicyNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="e.g. POL-2026-10-000123"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">Total Premium (₹) *</label>
              <input
                required
                min="0"
                step="0.01"
                type="number"
                value={actualPremium}
                onChange={(e) => setActualPremium(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-muted-foreground" />
                <span>Customer PAN / KYC *</span>
              </label>
              <input
                required
                type="text"
                value={customerPan}
                onChange={(e) => setCustomerPan(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="e.g. ABCDE1234F"
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <CreditCard className="h-3 w-3 text-muted-foreground" />
                <span>Payment Reference / UTR</span>
              </label>
              <input
                type="text"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="UTR / Cheque / Transaction Ref"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-xs">
            <input
              type="checkbox"
              id="confirmPayment"
              checked={confirmPaymentReceived}
              onChange={(e) => setConfirmPaymentReceived(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="confirmPayment" className="text-foreground font-semibold cursor-pointer">
              Reconcile & Confirm Premium Receipt (Section 64VB Advance Payment Verified)
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Policy Start Date *</label>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartDate(val);
                  if (val) {
                    const d = new Date(val);
                    d.setFullYear(d.getFullYear() + 1);
                    d.setDate(d.getDate() - 1);
                    setEndDate(d.toISOString().split('T')[0]);
                  }
                }}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Policy End Date *</label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          <div className="border rounded-xl p-3 space-y-2 bg-card">
            <div className="text-xs font-bold text-foreground">Motor OD Validity (Optional)</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={odStartDate}
                onChange={(e) => setOdStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                aria-label="OD start date"
              />
              <input
                type="date"
                value={odExpiryDate}
                onChange={(e) => setOdExpiryDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                aria-label="OD expiry date"
              />
            </div>
          </div>

          <div className="border rounded-xl p-3 space-y-2 bg-card">
            <div className="text-xs font-bold text-foreground">Motor TP Validity (Optional)</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={tpStartDate}
                onChange={(e) => setTpStartDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                aria-label="TP start date"
              />
              <input
                type="date"
                value={tpExpiryDate}
                onChange={(e) => setTpExpiryDate(e.target.value)}
                className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                aria-label="TP expiry date"
              />
            </div>
          </div>

          <div className="border rounded-xl p-3 space-y-2 bg-card">
            <div className="text-xs font-bold text-foreground">Issued Policy Document (PDF)</div>
            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed rounded-lg cursor-pointer hover:bg-muted text-xs transition">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {policyPdf ? policyPdf.name : 'Upload insurer policy schedule (PDF)'}
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPolicyPdf(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50 transition shadow-xs"
            >
              {loading ? (
                'Issuing Policy...'
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" /> Issue Policy
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
