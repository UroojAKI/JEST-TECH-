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
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, showApiErrorToast } from '@/lib/api-client';

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
  const [customerAadhaar, setCustomerAadhaar] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [confirmPaymentReceived, setConfirmPaymentReceived] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [policyPdf, setPolicyPdf] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Optional Agent POS attribution at policy issuance
  const [posPartnerId, setPosPartnerId] = useState('');
  const [posPartners, setPosPartners] = useState<any[]>([]);
  const [isLoadingPos, setIsLoadingPos] = useState(false);

  // Structured Address (DEC-06: Mandatory at Policy Issuance)
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

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

        const fetchedAadhaar =
          q.contact?.aadhaarNumber ||
          (q.healthMetadata as any)?.proposerAadhaar ||
          q.proposerDetails?.aadhaarNumber ||
          '';
        if (fetchedAadhaar && !customerAadhaar) {
          setCustomerAadhaar(fetchedAadhaar);
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

        // Pre-populate Structured Address (DEC-06)
        const proposer = (q.motorMetadata as any)?.proposerDetails || q.proposerDetails || {};
        const contact = q.contact || {};
        const hMeta = (q.healthMetadata as Record<string, any>) || {};

        const addr1 = contact.address || contact.addressLine1 || proposer.addressLine1 || proposer.address || proposer.communicationAddress || hMeta.communicationAddress || hMeta.address || '';
        if (addr1) setAddressLine1((prev) => prev || addr1);
        const addr2 = contact.addressLine2 || proposer.addressLine2 || '';
        if (addr2) setAddressLine2((prev) => prev || addr2);
        const c = contact.city || proposer.city || hMeta.city || '';
        if (c) setCity((prev) => prev || c);
        const st = contact.state || proposer.state || hMeta.state || '';
        if (st) setStateName((prev) => prev || st);
        const pin = contact.pincode || proposer.pincode || proposer.pinCode || hMeta.pincode || '';
        if (pin) setPincode((prev) => prev || String(pin).replace(/\D/g, ''));

        // Fetch eligible POS partners (DEC-02 & DEC-03)
        const insName = q.insurerName || '';
        const insurerQuery = insName ? `?insurerName=${encodeURIComponent(insName)}` : '';
        setIsLoadingPos(true);
        apiClient
          .get(`/pos-partners/eligible${insurerQuery}`)
          .then((pRes) => {
            if (!isMounted) return;
            const pList = Array.isArray(pRes.data) ? pRes.data : [];
            setPosPartners(pList);
          })
          .catch((pErr) => {
            console.warn('Could not fetch eligible POS partners:', pErr);
          })
          .finally(() => {
            if (isMounted) setIsLoadingPos(false);
          });
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
    setPdfError(null);

    // Existing policy PDF document check from quotation (REQ-2)
    const existingPolicyDoc =
      quoteDetails?.documents?.find(
        (d: any) =>
          (d.documentType === 'POLICY_DOCUMENT' || d.documentType === 'POLICY_SCHEDULE') &&
          d.fileKey,
      ) ||
      quoteDetails?.motorDocuments?.find(
        (d: any) =>
          (d.documentType === 'POLICY_DOCUMENT' || d.documentType === 'POLICY_SCHEDULE') &&
          d.fileKey,
      );

    if (!policyPdf && !existingPolicyDoc) {
      setPdfError('Official Policy PDF Schedule document is mandatory before issuing this policy.');
      showApiErrorToast(
        new Error(
          'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be completed or issued. Please upload the policy PDF.'
        ),
        'Policy PDF Required'
      );
      return;
    }

    if (!addressLine1.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      toast.error('Complete structured customer address is mandatory for policy issuance (DEC-06).');
      return;
    }

    if (pincode.replace(/\D/g, '').length !== 6) {
      toast.error('Valid 6-digit Indian PIN code is mandatory.');
      return;
    }

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
          customerAadhaar: customerAadhaar.trim() || undefined,
          paymentReference: paymentReference.trim() || undefined,
          confirmPaymentReceived,
          effectiveDate: startDate,
          expiryDate: endDate,
          posPartnerId,
          structuredAddress: {
            addressLine1: addressLine1.trim(),
            addressLine2: addressLine2.trim() || undefined,
            city: city.trim(),
            state: stateName.trim(),
            pincode: pincode.trim(),
            country: 'India',
          },
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
          posPartnerId,
          structuredAddress: {
            addressLine1: addressLine1.trim(),
            addressLine2: addressLine2.trim() || undefined,
            city: city.trim(),
            state: stateName.trim(),
            pincode: pincode.trim(),
            country: 'India',
          },
          ...documentFields,
        });

        toast.success(`Motor Policy ${actualPolicyNumber.trim()} successfully issued!`);
      }

      onSaved();
    } catch (error: any) {
      console.error('Policy issuance error:', error);
      const isPdfError =
        error?.response?.data?.message?.toString().toLowerCase().includes('pdf') ||
        error?.message?.toString().toLowerCase().includes('pdf');
      if (isPdfError) {
        setPdfError('Official Policy PDF Schedule document is mandatory before issuing this policy.');
      }
      showApiErrorToast(
        error,
        'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be issued.'
      );
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

          {/* Section: Customer PAN, Aadhaar & Payment Reference */}
          <div className={`grid grid-cols-1 ${isHealth ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-4`}>
            <div>
              <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                <UserCheck className="h-3 w-3 text-muted-foreground" />
                {isHealth ? (
                  <>
                    <span>Proposer PAN</span>
                    <span className="text-rose-500">*</span>
                  </>
                ) : (
                  <span>Customer PAN / KYC <span className="text-muted-foreground font-normal">(Optional)</span></span>
                )}
              </label>
              <input
                type="text"
                value={customerPan}
                maxLength={10}
                onChange={(e) => setCustomerPan(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                placeholder="ABCDE1234F"
              />
            </div>

            {isHealth && (
              <div>
                <label className="block text-xs font-bold mb-1 flex items-center gap-1">
                  <UserCheck className="h-3 w-3 text-muted-foreground" />
                  <span>Proposer Aadhaar</span>
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={customerAadhaar}
                  maxLength={12}
                  onChange={(e) => setCustomerAadhaar(e.target.value.replace(/\D/g, '').slice(0, 12))}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  placeholder="12-digit Aadhaar"
                />
              </div>
            )}

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

          {/* Optional Agent POS attribution */}
          <div className="p-3.5 rounded-xl border bg-card space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  Agent POS Attribution <span className="text-muted-foreground font-medium">(Optional)</span>
                </span>
              </label>
              <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded">
                Multiple insurer-specific Agent POS mappings
              </span>
            </div>

            {isLoadingPos ? (
              <div className="text-xs text-muted-foreground flex items-center gap-2 py-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading Agent POS records for {quoteDetails?.insurerName}...
              </div>
            ) : posPartners.length > 0 ? (
              <select
                value={posPartnerId}
                onChange={(e) => setPosPartnerId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-background font-medium focus:ring-1 focus:ring-primary focus:outline-none"
              >
                <option value="">No Agent POS attribution</option>
                {posPartners.map((p: any) => {
                  const mapping = p.insurerMappings?.find((m: any) => m.insurer?.name?.toLowerCase() === quoteDetails?.insurerName?.toLowerCase()) || p.insurerMappings?.[0];
                  return (
                    <option key={p.id} value={p.id}>
                      {p.posCode} • {p.name} ({p.partnerType}) — {mapping?.insurer?.name || quoteDetails?.insurerName} / Partner code: {mapping?.insurerPartnerCode || '—'} / POS ID: {mapping?.insurerPospId || '—'}
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
                <span>No Agent POS is currently mapped to {quoteDetails?.insurerName}. Policy issuance can continue without attribution.</span>
                <a href="/admin/pos-partners" target="_blank" className="font-bold underline text-primary">
                  Manage POS Partners
                </a>
              </div>
            )}
          </div>

          {/* Customer Structured Address (DEC-06: Mandatory) */}
          <div className="p-3.5 rounded-xl border bg-card space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5 text-primary" />
                <span>
                  Customer Structured Address <span className="text-rose-500 font-bold">* (Mandatory DEC-06)</span>
                </span>
              </label>
              <span className="text-[9px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">
                IRDAI Mandatory Address
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">Address Line 1 *</label>
                <input
                  required
                  type="text"
                  placeholder="Plot/Flat, Building Name, Street"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">Address Line 2 (Optional)</label>
                <input
                  type="text"
                  placeholder="Locality, Landmark"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">City *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">State *</label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">PIN Code (6 digits) *</label>
                <input
                  required
                  maxLength={6}
                  type="text"
                  placeholder="400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono font-bold bg-background focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-muted-foreground mb-0.5">Country</label>
                <input
                  disabled
                  type="text"
                  value="India"
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-muted text-muted-foreground"
                />
              </div>
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

          {/* Upload Issued Policy PDF Document (Statutory REQ-2 Requirement) */}
          <div
            className={`border rounded-xl p-4 space-y-2.5 transition-all ${
              pdfError
                ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
                : policyPdf
                ? 'border-emerald-500 bg-emerald-500/5'
                : 'border-border bg-card'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className={`h-4 w-4 ${policyPdf ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span className="text-xs font-bold text-foreground">
                  Official Policy Schedule Document (PDF) <span className="text-rose-500 font-bold">* (Mandatory)</span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                Required for Issuance
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Under IRDAI underwriting regulations, the official signed policy schedule PDF must be attached before this policy can be completed or legally issued.
            </p>

            <label
              className={`flex items-center justify-between gap-3 px-3.5 py-3 border-2 border-dashed rounded-xl cursor-pointer transition ${
                policyPdf
                  ? 'border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/15'
                  : pdfError
                  ? 'border-rose-500 bg-rose-500/10 hover:bg-rose-500/15'
                  : 'border-border/80 hover:border-primary/80 bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {policyPdf ? (
                  <FileCheck2 className="h-5 w-5 text-emerald-600 shrink-0" />
                ) : (
                  <Upload className={`h-5 w-5 shrink-0 ${pdfError ? 'text-rose-500' : 'text-muted-foreground'}`} />
                )}
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate text-foreground">
                    {policyPdf
                      ? policyPdf.name
                      : isHealth
                      ? 'Upload official Health Policy Schedule (PDF) *'
                      : 'Upload official Motor Policy Schedule (PDF) *'}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {policyPdf
                      ? `${(policyPdf.size / 1024).toFixed(1)} KB • Attached and verified`
                      : 'PDF format only, maximum 15MB'}
                  </div>
                </div>
              </div>

              {policyPdf ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPolicyPdf(null);
                  }}
                  className="p-1 rounded text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : (
                <span className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary text-primary-foreground shrink-0 shadow-xs">
                  Browse PDF
                </span>
              )}

              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file) {
                    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
                      toast.error('Only PDF documents are supported for official policy schedules');
                      setPdfError('Only PDF files are accepted');
                      return;
                    }
                    setPolicyPdf(file);
                    setPdfError(null);
                  }
                }}
              />
            </label>

            {pdfError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold pt-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}
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
                !policyPdf
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : isHealth
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Issuing Policy...</span>
                </>
              ) : !policyPdf ? (
                <>
                  <Upload className="h-4 w-4" />
                  <span>Upload Policy PDF to Issue</span>
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
