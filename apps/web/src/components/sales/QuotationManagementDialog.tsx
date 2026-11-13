'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock3, FileText, Loader2, RefreshCw, Save, X } from 'lucide-react';
import { quotationsRepository } from '../../repositories/quotations.repository';

type Props = {
  quotationId: string;
  isOpen: boolean;
  onClose: () => void;
  onUpdated?: () => void;
};

const EDITABLE_FIELDS = new Set([
  'customerName', 'phone', 'email', 'dateOfBirth', 'address', 'pincode',
  'makeModel', 'registrationNumber', 'engineNumber', 'chassisNumber',
  'dateOfRegistration', 'previousPolicyNumber', 'previousInsurerName',
  'previousPolicyExpiryDate',
]);

const DATE_FIELDS = new Set(['dateOfBirth', 'dateOfRegistration', 'previousPolicyExpiryDate']);

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function pairs(value: any): Array<[string, unknown]> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value).filter(([, item]) => item !== undefined && item !== null && typeof item !== 'object');
}

export function QuotationManagementDialog({ quotationId, isOpen, onClose, onUpdated }: Props) {
  const [quotation, setQuotation] = useState<any>(null);
  const [completion, setCompletion] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [detail, progress, events, revisions] = await Promise.all([
        quotationsRepository.getQuotationById(quotationId),
        quotationsRepository.getQuotationCompletion(quotationId),
        quotationsRepository.getQuotationHistory(quotationId),
        quotationsRepository.getQuotationVersions(quotationId),
      ]);
      setQuotation(detail);
      setCompletion(progress);
      setHistory(Array.isArray(events) ? events : []);
      setVersions(Array.isArray(revisions) ? revisions : []);
      const next: Record<string, string> = {};
      for (const section of progress?.sections || []) {
        for (const field of section.missing || []) {
          if (EDITABLE_FIELDS.has(field.field)) next[field.field] = '';
        }
      }
      setValues(next);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Unable to load quotation details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && quotationId) void load();
    // load is intentionally scoped to the opened quotation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, quotationId]);

  const missingCount = useMemo(
    () => (completion?.sections || []).reduce((sum: number, section: any) => sum + (section.missing?.length || 0), 0),
    [completion],
  );

  const save = async () => {
    const updates = Object.fromEntries(
      Object.entries(values).filter(([, value]) => value.trim() !== ''),
    );
    if (!Object.keys(updates).length) {
      toast.info('Enter at least one missing value before saving.');
      return;
    }
    setSaving(true);
    try {
      const next = await quotationsRepository.updateQuotationDetails(quotationId, updates);
      setCompletion(next);
      toast.success('Quotation details updated and completion recalculated.');
      await load();
      onUpdated?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Could not update quotation details');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const metadata = quotation?.motorMetadata || {};
  const proposer = metadata.proposerDetails || {};
  const vehicle = metadata.vehicleDetails || quotation?.vehicle || {};
  const previous = metadata.previousPolicyDetails || quotation?.motorPreviousPolicy || {};
  const snapshot = quotation?.calculationSnapshot || {};
  const outputs = snapshot.outputs || snapshot.result?.outputs || {};
  const premiumRows = [
    ['Own Damage (OD)', outputs.od?.gross ?? outputs.odPremium ?? outputs.baseOdPremium ?? quotation?.odPremium],
    ['Third Party (TP)', outputs.tp?.base ?? outputs.baseTpPremium ?? outputs.annualTpPremium ?? outputs.netTpPremium ?? quotation?.tpPremium],
    ['Add-ons', outputs.addonPremium ?? outputs.od?.addons ?? outputs.addOnsPremium],
    ['NCB discount', outputs.od?.ncbDiscount ?? outputs.ncbDiscount ?? outputs.ncbDiscountAmount],
    ['OD discount', outputs.od?.specialDiscount ?? outputs.odDiscountAmount ?? outputs.odDiscount],
    ['TP discount', outputs.tp?.discount ?? outputs.tpDiscountAmount ?? outputs.tpDiscount],
    ['Commercial discount', outputs.commercialDiscountAmount ?? outputs.discounts?.commercial?.amount],
    ['Total discounts', outputs.totalDiscountAmount ?? outputs.totalDiscount ?? outputs.summary?.totalDiscount],
    ['GST', outputs.summary?.totalGst ?? outputs.totalGst ?? outputs.gstAmount ?? quotation?.gstAmount],
    ['Final payable', outputs.summary?.finalPayable ?? outputs.finalPayableAmount ?? outputs.totalPremium ?? quotation?.totalPremium],
  ].filter(([, value]) => value !== undefined && value !== null);

  const payments = quotation?.motorPaymentRecord
    ? (Array.isArray(quotation.motorPaymentRecord) ? quotation.motorPaymentRecord : [quotation.motorPaymentRecord])
    : [];
  const documents = [
    ...(Array.isArray(quotation?.motorDocuments) ? quotation.motorDocuments : []),
    ...(Array.isArray(quotation?.documents) ? quotation.documents : []),
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Quotation details">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Quotation details & completion</h2>
            <p className="text-xs text-muted-foreground">{quotation?.quotationCode || quotationId} · Full record, completion checklist, premium, payment and history</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-muted" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        {loading && !quotation ? (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading quotation…</div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1.35fr_1fr]">
            <div className="space-y-5 p-5">
              <section className="rounded-xl border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold">Completion checklist</h3>
                  <span className="text-sm font-bold">{completion?.completionPercentage ?? 0}% complete</span>
                </div>
                <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${completion?.completionPercentage || 0}%` }} /></div>
                {(completion?.sections || []).map((section: any) => (
                  <div key={section.section} className="border-t py-3 first:border-0">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{section.label}</span>
                      {section.complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-xs text-amber-600">{section.missing?.length || 0} missing</span>}
                    </div>
                    {(section.missing || []).map((field: any) => (
                      <label key={field.field} className="mb-2 block text-xs">
                        <span className="mb-1 block text-muted-foreground">{field.label} · {field.requiredFor.replaceAll('_', ' ')}</span>
                        {EDITABLE_FIELDS.has(field.field) ? (
                          <input
                            type={DATE_FIELDS.has(field.field) ? 'date' : 'text'}
                            value={values[field.field] || ''}
                            onChange={(event) => setValues((current) => ({ ...current, [field.field]: event.target.value }))}
                            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
                            placeholder={`Enter ${field.label.toLowerCase()}`}
                          />
                        ) : (
                          <span className="block rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground">Complete this through the quotation / proposal workflow.</span>
                        )}
                      </label>
                    ))}
                  </div>
                ))}
                {missingCount > 0 && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Only fields supported by the completion endpoint are editable here. Payment, inspection, document verification and coverage calculations must be completed in their dedicated workflows.</span>
                  </div>
                )}
                <button type="button" onClick={() => void save()} disabled={saving || Object.values(values).every((value) => !value.trim())} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save missing information
                </button>
              </section>

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-semibold">Customer & vehicle</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {pairs({ ...proposer, customerName: proposer.customerName || quotation?.contact?.fullName || [quotation?.contact?.firstName, quotation?.contact?.lastName].filter(Boolean).join(' '), phone: proposer.mobileNumber || quotation?.contact?.phone, email: proposer.emailId || quotation?.contact?.email, address: proposer.address || quotation?.contact?.address, ...vehicle }).map(([key, value]) => (
                    <div key={key} className="min-w-0"><div className="text-[11px] capitalize text-muted-foreground">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</div><div className="break-words text-sm font-medium">{displayValue(value)}</div></div>
                  ))}
                </div>
                <h4 className="mb-2 mt-4 text-sm font-semibold">Previous policy</h4>
                <div className="grid gap-2 sm:grid-cols-2">{pairs(previous).map(([key, value]) => <div key={key}><div className="text-[11px] capitalize text-muted-foreground">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</div><div className="text-sm">{displayValue(value)}</div></div>)}</div>
              </section>

              <section className="rounded-xl border p-4">
                <h3 className="mb-3 font-semibold">Documents</h3>
                {documents.length ? documents.map((doc: any, index: number) => <div key={doc.id || index} className="flex items-center gap-2 border-t py-2 text-sm first:border-0"><FileText className="h-4 w-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{doc.document?.name || doc.document?.documentType || doc.name || doc.documentType || doc.fileName || 'Supporting document'}</span><span className="text-xs text-muted-foreground">{doc.status || doc.verificationStatus || 'Uploaded'}</span></div>) : <p className="text-sm text-muted-foreground">No document records returned for this quotation.</p>}
              </section>
            </div>

            <aside className="space-y-5 border-t bg-muted/20 p-5 lg:border-l lg:border-t-0">
              <section className="rounded-xl border bg-background p-4">
                <h3 className="mb-3 font-semibold">Quotation & premium</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-xs text-muted-foreground">Insurer</div><div className="font-medium">{quotation?.insurerName || 'Not recorded'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Status</div><div className="font-medium">{quotation?.status || '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Quote number</div><div className="font-medium">{quotation?.quotationCode || '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">Version</div><div className="font-medium">{quotation?.version ?? '—'}</div></div>
                  <div><div className="text-xs text-muted-foreground">IDV / Sum insured</div><div className="font-medium">{displayValue(quotation?.sumInsured)}</div></div>
                  <div><div className="text-xs text-muted-foreground">Total premium</div><div className="font-bold">{displayValue(quotation?.totalPremium)}</div></div>
                </div>
                <div className="mt-4 border-t pt-3">
                  <h4 className="mb-2 text-sm font-semibold">Premium breakdown (saved calculation snapshot)</h4>
                  {premiumRows.length ? premiumRows.map(([label, value]) => <div key={String(label)} className="flex justify-between gap-3 py-1 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium">{displayValue(value)}</span></div>) : <p className="text-xs text-muted-foreground">No component-level calculation values were returned in the saved snapshot.</p>}
                </div>
              </section>

              <section className="rounded-xl border bg-background p-4">
                <h3 className="mb-3 font-semibold">Payment & reconciliation</h3>
                {payments.length ? payments.map((payment: any, index: number) => <div key={payment.id || index} className="space-y-1 border-t py-2 text-sm first:border-0">{pairs(payment).map(([key, value]) => <div key={key} className="flex justify-between gap-3"><span className="capitalize text-muted-foreground">{key.replace(/[A-Z]/g, (letter) => ` ${letter}`)}</span><span className="max-w-[60%] break-all text-right">{displayValue(value)}</span></div>)}</div>) : <p className="text-sm text-muted-foreground">No payment record is attached to this quotation response. Open Proposal / Payment for the full collection and reconciliation workflow.</p>}
              </section>

              <section className="rounded-xl border bg-background p-4">
                <h3 className="mb-3 font-semibold">Quotation versions</h3>
                {versions.length ? versions.map((revision: any, index: number) => <div key={revision.id || index} className="border-t py-2 first:border-0"><div className="flex items-center justify-between gap-2 text-sm"><span className="font-medium">Version {revision.versionNumber || revision.version || index + 1}</span><span className="text-xs text-muted-foreground">{revision.createdAt ? new Date(revision.createdAt).toLocaleString() : '—'}</span></div><p className="mt-1 text-xs text-muted-foreground">{revision.changeReason || revision.comments || revision.status || 'Saved quotation revision'}</p></div>) : <p className="text-sm text-muted-foreground">No separate revision snapshots are recorded.</p>}
              </section>

              <section className="rounded-xl border bg-background p-4">
                <h3 className="mb-3 flex items-center gap-2 font-semibold"><Clock3 className="h-4 w-4" /> Quotation history</h3>
                {history.length ? history.map((event: any, index: number) => <div key={event.id || index} className="border-t py-2 first:border-0"><div className="flex items-center justify-between gap-2 text-sm font-medium"><span>{event.status || event.action || 'Updated'}</span><span className="text-xs text-muted-foreground">{event.createdAt ? new Date(event.createdAt).toLocaleString() : '—'}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.comments || event.description || event.createdBy?.name || 'Workflow event recorded'}</p></div>) : <p className="text-sm text-muted-foreground">No quotation history events returned.</p>}
              </section>

              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border bg-background px-3 py-2 text-xs font-semibold"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh record</button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
