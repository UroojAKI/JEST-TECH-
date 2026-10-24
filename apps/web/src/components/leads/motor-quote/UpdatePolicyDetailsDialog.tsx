'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle,
  Upload,
  ShieldCheck,
  CreditCard,
  UserCheck,
  AlertCircle,
  HeartPulse,
  Car,
  Users,
  FileCheck2,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  quotationId: string;
  productType?: 'MOTOR' | 'HEALTH';
  onSaved: () => void;
}

export function UpdatePolicyDetailsDialog({
  isOpen,
  onClose,
  quotationId,
  productType,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [quoteDetails, setQuoteDetails] = useState<any>(null);

  // Common Authoritative Policy fields
  const [actualPolicyNumber, setActualPolicyNumber] = useState('');
  const [actualPremium, setActualPremium] = useState('');
  const [customerPan, setCustomerPan] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmPaymentReceived, setConfirmPaymentReceived] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [policyPdf, setPolicyPdf] = useState<File | null>(null);

  // Motor-specific fields (Only for Motor policies)
  const [odStartDate, setOdStartDate] = useState('');
  const [odExpiryDate, setOdExpiryDate] = useState('');
  const [tpStartDate, setTpStartDate] = useState('');
  const [tpExpiryDate, setTpExpiryDate] = useState('');

  // Health-specific fields (Only for Health policies)
  const [planName, setPlanName] = useState('Comprehensive Health Plan');
  const [sumInsured, setSumInsured] = useState('500000');
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('Spouse');
  const [tpaName, setTpaName] = useState('');
  const [medicalUnderwritingVerified, setMedicalUnderwritingVerified] = useState(true);
  const [membersList, setMembersList] = useState<any[]>([]);

  // Determine whether this dialog is handling a Health quotation
  const isHealth =
    productType === 'HEALTH' ||
    quoteDetails?.productType === 'HEALTH' ||
    Boolean(quoteDetails?.healthCaseId) ||
    Boolean(quoteDetails?.healthMetadata);

  useEffect(() => {
    if (!isOpen || !quotationId) return;
    let isMounted = true;
    setFetchingQuote(true);

    apiClient
      .get(`/quotations/${quotationId}`)
      .then((res) => {
        if (!isMounted) return;
        const q = res.data?.data || res.data;
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
          (q.healthMetadata as any)?.proposerPan ||
          q.proposerDetails?.panNumber ||
          '';
        if (fetchedPan && !customerPan) {
          setCustomerPan(fetchedPan);
        }

        const paymentRef =
          q.motorPaymentRecord?.referenceNumber ||
          q.paymentRecord?.referenceNumber ||
          q.paymentReference ||
          '';
        if (paymentRef && !paymentReference) {
          setPaymentReference(paymentRef);
        }

        // Set dates from quotation snapshot if present
        const qStart = q.policyStartDate || (q.healthMetadata as any)?.policyStartDate;
        const qEnd = q.policyEndDate || (q.healthMetadata as any)?.policyEndDate;

        if (qStart) {
          setStartDate(new Date(qStart).toISOString().split('T')[0]);
        } else if (!startDate) {
          const today = new Date().toISOString().split('T')[0];
          setStartDate(today);
        }

        if (qEnd) {
          setEndDate(new Date(qEnd).toISOString().split('T')[0]);
        } else if (!endDate) {
          const nextYear = new Date();
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          nextYear.setDate(nextYear.getDate() - 1);
          setEndDate(nextYear.toISOString().split('T')[0]);
        }

        // Health-specific pre-population
        const isHealthItem =
          productType === 'HEALTH' ||
          q.productType === 'HEALTH' ||
          Boolean(q.healthCaseId) ||
          Boolean(q.healthMetadata);

        if (isHealthItem) {
          const healthMeta = (q.healthMetadata as Record<string, any>) || {};
          const healthCase = q.healthCase || {};

          if (healthMeta.planName || q.planName) {
            setPlanName(healthMeta.planName || q.planName);
          }
          if (healthMeta.sumInsured || q.sumInsured) {
            setSumInsured(String(healthMeta.sumInsured || q.sumInsured));
          }
          if (healthCase.nomineeName || healthMeta.nomineeName) {
            setNomineeName(healthCase.nomineeName || healthMeta.nomineeName);
          } else if (q.contact) {
            setNomineeName(`${q.contact.firstName} ${q.contact.lastName || ''}`.trim());
          }
          if (healthCase.nomineeRelation || healthMeta.nomineeRelation) {
            setNomineeRelation(healthCase.nomineeRelation || healthMeta.nomineeRelation);
          }
          if (healthMeta.tpaName) {
            setTpaName(healthMeta.tpaName);
          }
          if (healthCase.members && Array.isArray(healthCase.members)) {
            setMembersList(healthCase.members);
          } else if (healthMeta.members && Array.isArray(healthMeta.members)) {
            setMembersList(healthMeta.members);
          }
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
  }, [isOpen, quotationId, productType]);

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
      if (isHealth) {
        // =========================================================================
        // HEALTH POLICY MANUAL ISSUANCE
        // =========================================================================
        let documentFields: Record<string, unknown> = {};
        if (policyPdf) {
          const formData = new FormData();
          formData.append('file', policyPdf);
          formData.append('name', `Issued Health Policy - ${actualPolicyNumber.trim()}`);
          formData.append('entityType', 'QUOTATION');
          formData.append('entityId', quotationId);
          formData.append('category', 'HEALTH_POLICY_SCHEDULE');
          formData.append('tags', 'health,policy,issued');

          const upload = await apiClient.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const storageKey = upload.data?.storageKey;
          if (storageKey) {
            documentFields = {
              documentFileKey: storageKey,
              documentFileName: policyPdf.name,
              documentFileSize: policyPdf.size,
            };
          }
        }

        // Parse nominee name
        const nomParts = (nomineeName.trim() || 'Nominee').split(' ');
        const nomFirstName = nomParts[0] || 'Nominee';
        const nomLastName = nomParts.slice(1).join(' ') || '';

        // Issue via standard Back Office issuance endpoint
        await apiClient.post(`/back-office/issue/${quotationId}`, {
          actualPolicyNumber: actualPolicyNumber.trim(),
          actualPremium: parseFloat(actualPremium),
          customerPan: customerPan.trim() || undefined,
          paymentReference: paymentReference.trim() || undefined,
          confirmPaymentReceived,
          effectiveDate: startDate,
          expiryDate: endDate,
          nominees: [
            {
              firstName: nomFirstName,
              lastName: nomLastName,
              relation: nomineeRelation.toUpperCase() || 'SPOUSE',
              percentage: 100,
            },
          ],
          ...documentFields,
        });

        toast.success(`Health Policy ${actualPolicyNumber.trim()} successfully issued!`);
      } else {
        // =========================================================================
        // MOTOR POLICY MANUAL ISSUANCE
        // =========================================================================
        let documentFields: Record<string, unknown> = {};
        if (policyPdf) {
          const formData = new FormData();
          formData.append('file', policyPdf);
          formData.append('name', `Issued Motor Policy - ${actualPolicyNumber.trim()}`);
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

        toast.success(`Motor Policy ${actualPolicyNumber.trim()} successfully issued!`);
      }

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
      toast.error(displayMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isHealth
                  ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
                  : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
              }`}
            >
              {isHealth ? <HeartPulse className="h-5 w-5" /> : <Car className="h-5 w-5" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-foreground">
                  {isHealth ? 'Manual Health Policy Issuance' : 'Manual Motor Policy Issuance'}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                    isHealth
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  {isHealth ? 'Health Insurance' : 'Motor Insurance'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Back Office Underwriting Authority · Section 64VB Compliant
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* Quotation Snapshot Card */}
          {quoteDetails && (
            <div className="bg-muted/40 border rounded-xl p-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold text-foreground">
                    {quoteDetails.quotationCode}
                  </span>
                  <span className="text-muted-foreground">
                    • {quoteDetails.contact?.firstName} {quoteDetails.contact?.lastName || ''}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Insurer: <strong className="text-foreground">{quoteDetails.insurerName || 'HDFC ERGO'}</strong>
                </div>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground mr-1 text-[11px]">Net Premium:</span>
                <span className="font-mono font-bold text-emerald-600 text-sm">
                  ₹{Number(netPayable || 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>
          )}

          {/* Section: Policy Identification & Premium */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                Actual Policy Number <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="text"
                value={actualPolicyNumber}
                onChange={(e) => setActualPolicyNumber(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder={isHealth ? 'e.g. HDFC-HLT-2026-000123' : 'e.g. POL-MOT-2026-000123'}
              />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                Total Premium (₹) <span className="text-rose-500">*</span>
              </label>
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

          {/* Section: Customer PAN & Payment Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-muted-foreground" />
                <span>{isHealth ? 'Proposer PAN / KYC' : 'Customer PAN / KYC'}</span>
                <span className="text-rose-500">*</span>
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
                placeholder="UTR / Transaction Ref / Cheque"
              />
            </div>
          </div>

          {/* Reconcile Section 64VB */}
          <div className="flex items-center gap-2 p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-xs">
            <input
              type="checkbox"
              id="confirmPayment"
              checked={confirmPaymentReceived}
              onChange={(e) => setConfirmPaymentReceived(e.target.checked)}
              className="rounded text-primary focus:ring-primary h-4 w-4"
            />
            <label htmlFor="confirmPayment" className="text-foreground font-semibold cursor-pointer">
              Reconcile & Confirm Advance Premium (Section 64VB Verified)
            </label>
          </div>

          {/* Policy Start & End Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                Policy Start Date <span className="text-rose-500">*</span>
              </label>
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
              <label className="block text-xs font-bold mb-1">
                Policy End Date <span className="text-rose-500">*</span>
              </label>
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* PRODUCT SPECIFIC SECTIONS: HEALTH vs MOTOR                                */}
          {/* ========================================================================= */}
          {isHealth ? (
            /* HEALTH SPECIFIC UNDERWRITING & NOMINEE DETAILS (NO MOTOR OD/TP) */
            <div className="space-y-3.5 pt-1">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.03] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <HeartPulse className="h-4 w-4 text-rose-500" />
                    <span>Health Coverage & Underwriting Specifications</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-rose-600 bg-rose-500/10 px-2 py-0.5 rounded">
                    Health Only
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Health Plan Name / Tier
                    </label>
                    <input
                      type="text"
                      value={planName}
                      onChange={(e) => setPlanName(e.target.value)}
                      placeholder="e.g. Optima Secure / Family Floater"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Sum Insured (₹)
                    </label>
                    <input
                      type="text"
                      value={sumInsured}
                      onChange={(e) => setSumInsured(e.target.value)}
                      placeholder="e.g. 500000, 1000000"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>
                </div>

                {/* Nominee Details (Essential for Health policies) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Nominee Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      type="text"
                      value={nomineeName}
                      onChange={(e) => setNomineeName(e.target.value)}
                      placeholder="e.g. Priya Sharma"
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                      Nominee Relationship
                    </label>
                    <select
                      value={nomineeRelation}
                      onChange={(e) => setNomineeRelation(e.target.value)}
                      className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="Spouse">Spouse</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Son">Son</option>
                      <option value="Daughter">Daughter</option>
                      <option value="Brother">Brother</option>
                      <option value="Sister">Sister</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                {/* TPA Provider */}
                <div>
                  <label className="block text-[11px] font-bold mb-1 text-muted-foreground">
                    TPA / Network Administrator (Optional)
                  </label>
                  <input
                    type="text"
                    value={tpaName}
                    onChange={(e) => setTpaName(e.target.value)}
                    placeholder="e.g. Medi Assist TPA / Vidal Health / In-House Desk"
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Medical Underwriting Verification Checkbox */}
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-emerald-500/5 border-emerald-500/20 text-xs">
                  <input
                    type="checkbox"
                    id="medicalUW"
                    checked={medicalUnderwritingVerified}
                    onChange={(e) => setMedicalUnderwritingVerified(e.target.checked)}
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <label htmlFor="medicalUW" className="text-foreground font-semibold cursor-pointer text-[11px]">
                    Pre-Existing Diseases (PED) & Medical Underwriting Sign-Off Confirmed
                  </label>
                </div>

                {/* Covered Members List (if present) */}
                {membersList.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      Covered Members ({membersList.length}):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {membersList.map((m: any, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded text-[10px] bg-background border font-medium flex items-center gap-1"
                        >
                          <Users className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {m.firstName} {m.lastName || ''} ({m.relation})
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* MOTOR SPECIFIC OD & TP VALIDITY SECTIONS (Only for Motor policies) */
            <>
              <div className="border rounded-xl p-3 space-y-2 bg-card">
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>🚗 Motor OD Validity (Optional)</span>
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                    Motor OD
                  </span>
                </div>
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
                <div className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>🚗 Motor TP Validity (Optional)</span>
                  <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                    Motor TP
                  </span>
                </div>
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
            </>
          )}

          {/* Upload Issued Policy PDF Document */}
          <div className="border rounded-xl p-3 space-y-2 bg-card">
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>Issued Policy Document (PDF)</span>
              <span className="text-[10px] text-muted-foreground">Official Schedule</span>
            </div>
            <label className="flex items-center gap-2 px-3 py-2.5 border border-dashed rounded-lg cursor-pointer hover:bg-muted text-xs transition">
              <Upload className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">
                {policyPdf
                  ? policyPdf.name
                  : isHealth
                  ? 'Upload official Health Policy Schedule (PDF)'
                  : 'Upload official Motor Policy Schedule (PDF)'}
              </span>
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={(e) => setPolicyPdf(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border rounded-xl text-xs font-bold hover:bg-muted transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-5 py-2 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50 transition shadow-xs ${
                isHealth
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Issuing Policy...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span>{isHealth ? 'Issue Health Policy' : 'Issue Motor Policy'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
