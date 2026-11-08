'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, ShieldCheck, FileCheck, Car, UserCheck, Sparkles, FileText, Upload, AlertCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient, showApiErrorToast } from '../../../lib/api-client';

interface Props {
  isOpen: boolean;
  quote: any;
  onClose: () => void;
  onSuccess: (policy: any) => void;
}

export function PolicyCompletionDialog({ isOpen, quote, onClose, onSuccess }: Props) {
  const [policyNumber, setPolicyNumber] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  });

  // Customer & KYC info
  const [customerName, setCustomerName] = useState('');
  const [customerPan, setCustomerPan] = useState('');

  // Structured Address (DEC-06: Mandatory at Policy Issuance)
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // POS Partner Selection (DEC-02: Mandatory at Policy Issuance)
  const [posPartnerId, setPosPartnerId] = useState('');
  const [posPartners, setPosPartners] = useState<any[]>([]);
  const [isLoadingPos, setIsLoadingPos] = useState(false);

  // Vehicle info
  const [regNumber, setRegNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [makeModel, setMakeModel] = useState('');
  const [yearMonth, setYearMonth] = useState('2023');

  // Nominee info
  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('Spouse');
  const [nomineeAge, setNomineeAge] = useState('30');

  // Policy PDF Document (REQ-2)
  const [policyPdfFile, setPolicyPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const pdfInputRef = React.useRef<HTMLInputElement | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Autofill from quote prop immediately and refresh authoritative details from backend
  useEffect(() => {
    if (!isOpen || !quote?.id) return;
    let isMounted = true;

    // Helper to safely extract and populate form fields from any quote representation
    const populateFromData = (data: any) => {
      if (!data) return;
      const vehicleDetails = data.vehicle || data.vehicleDetails || (data.motorMetadata as any)?.vehicleDetails || {};
      const proposer = data.proposerDetails || (data.motorMetadata as any)?.proposerDetails || {};
      const contact = data.contact || {};

      const pan = contact.panNumber || proposer.panNumber || data.customerPan || data.panNumber || '';
      if (pan) setCustomerPan((prev) => prev || pan);

      const name = (contact.firstName ? `${contact.firstName} ${contact.lastName || ''}`.trim() : null) ||
        proposer.customerName ||
        data.customerName ||
        '';
      if (name) setCustomerName((prev) => prev || name);

      const reg = data.registrationNumber || vehicleDetails.registrationNumber || '';
      if (reg) setRegNumber((prev) => prev || reg);

      const eng = vehicleDetails.engineNumber || '';
      if (eng) setEngineNumber((prev) => prev || eng);

      const chas = vehicleDetails.chassisNumber || '';
      if (chas) setChassisNumber((prev) => prev || chas);

      const mm = vehicleDetails.makeModel || vehicleDetails.makeModelVariant || vehicleDetails.vehicleMake || '';
      if (mm) setMakeModel((prev) => prev || mm);

      const ym = vehicleDetails.manufactureYearMonth || '';
      if (ym) setYearMonth((prev) => (prev && prev !== '2023' ? prev : ym));

      const nomName = proposer.nomineeName || (data.motorMetadata as any)?.nomineeName || (data.motorMetadata as any)?.proposerDetails?.nomineeName || '';
      if (nomName) setNomineeName((prev) => prev || nomName);

      const nomRel = proposer.nomineeRelation || (data.motorMetadata as any)?.nomineeRelation || (data.motorMetadata as any)?.proposerDetails?.nomineeRelation || '';
      if (nomRel) setNomineeRelation((prev) => (prev && prev !== 'Spouse' ? prev : nomRel));

      const nomAge = proposer.nomineeAge ? String(proposer.nomineeAge) : ((data.motorMetadata as any)?.nomineeAge ? String((data.motorMetadata as any).nomineeAge) : '');
      if (nomAge) setNomineeAge((prev) => (prev && prev !== '30' ? prev : nomAge));

      // Extract Structured Address (DEC-06)
      const addr1 = contact.address || contact.addressLine1 || proposer.addressLine1 || proposer.address || proposer.communicationAddress || '';
      if (addr1) setAddressLine1((prev) => prev || addr1);
      const addr2 = contact.addressLine2 || proposer.addressLine2 || '';
      if (addr2) setAddressLine2((prev) => prev || addr2);
      const c = contact.city || proposer.city || '';
      if (c) setCity((prev) => prev || c);
      const st = contact.state || proposer.state || '';
      if (st) setStateName((prev) => prev || st);
      const pin = contact.pincode || proposer.pincode || proposer.pinCode || '';
      if (pin) setPincode((prev) => prev || String(pin).replace(/\D/g, ''));
    };

    // 1. Initial pass from existing props
    populateFromData(quote);

    // 2. Fetch fresh quotation from API to pull latest updates (e.g., from Missing Details view or wizard)
    setIsLoadingDetails(true);
    apiClient
      .get(`/quotations/${quote.id}`)
      .then((res) => {
        if (!isMounted) return;
        const fresh = res.data?.data || res.data;
        populateFromData(fresh);
      })
      .catch((err) => {
        console.warn('Could not refresh quotation details for dialog:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingDetails(false);
      });

    // 3. Fetch eligible POS partners mapped to the quote's insurer (DEC-02 & DEC-03)
    const posParams = new URLSearchParams();
    if (quote.insurerName) posParams.set('insurerName', quote.insurerName);
    posParams.set('productType', 'MOTOR');
    setIsLoadingPos(true);
    apiClient
      .get(`/pos-partners/eligible?${posParams.toString()}`)
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res.data) ? res.data : [];
        setPosPartners(list);
      })
      .catch((err) => {
        console.warn('Could not fetch eligible POS partners:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPos(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, quote?.id]);

  if (!isOpen || !quote) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!engineNumber.trim() || !chassisNumber.trim()) {
      toast.error('Engine Number and Chassis Number are mandatory for policy issuance.');
      return;
    }

    if (!nomineeName.trim()) {
      toast.error('Nominee Full Name is required for statutory IRDAI compliance.');
      return;
    }

    if (!posPartnerId) {
      toast.error('POS Partner selection is mandatory for policy issuance (DEC-02).');
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

    if (!policyPdfFile) {
      setPdfError('Official Policy PDF Schedule document is mandatory before policy can be issued.');
      showApiErrorToast(
        new Error(
          'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be completed or issued. Please upload the policy PDF.'
        ),
        'Policy PDF Required'
      );
      return;
    }

    setIsSubmitting(true);
    setPdfError(null);
    try {
      // 1. Upload PDF document to get storageKey
      const formData = new FormData();
      formData.append('file', policyPdfFile);
      formData.append('name', policyPdfFile.name);
      formData.append('category', 'POLICY_DOCUMENT');
      formData.append('entityType', 'POLICY');
      formData.append('entityId', quote.id);

      const uploadRes = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const storageKey = uploadRes.data?.storageKey;
      if (!storageKey) {
        throw new Error('Failed to obtain document storage key from upload');
      }

      const payload = {
        actualPolicyNumber: policyNumber.trim() || undefined,
        actualPremium: Number(quote.totalPremium || 0),
        customerPan: customerPan.trim() ? customerPan.trim().toUpperCase() : undefined,
        startDate,
        endDate,
        registrationNumber: regNumber.trim() || quote.registrationNumber,
        engineNumber: engineNumber.trim(),
        chassisNumber: chassisNumber.trim(),
        makeModel: makeModel.trim(),
        manufactureYearMonth: yearMonth.trim(),
        nomineeName: nomineeName.trim(),
        nomineeRelation,
        nomineeAge: parseInt(nomineeAge, 10) || 30,
        posPartnerId,
        structuredAddress: {
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          state: stateName.trim(),
          pincode: pincode.trim(),
          country: 'India',
        },
        documentFileKey: storageKey,
        documentFileName: policyPdfFile.name,
        documentFileSize: policyPdfFile.size,
      };

      const res = await apiClient.post(`/motor/quotes/${quote.id}/issue`, payload);
      const policy = res.data;
      toast.success(`Policy ${policy.policyNumber || policyNumber} issued successfully!`);
      onSuccess(policy);
      onClose();
    } catch (err: any) {
      console.warn('Policy issuance error:', err);
      const isPdfError =
        err?.response?.data?.message?.toString().toLowerCase().includes('pdf') ||
        err?.message?.toString().toLowerCase().includes('pdf');
      if (isPdfError) {
        setPdfError('Official Policy PDF Schedule document is mandatory before policy can be issued.');
      }
      showApiErrorToast(
        err,
        'Policy issuance blocked: Official policy schedule PDF document is mandatory before policy can be completed or issued.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl bg-card rounded-2xl border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-emerald-500/10 via-background to-transparent">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-black text-base text-foreground">Complete Policy & Add Missing Information</h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Instant Issuance
                </span>
                {isLoadingDetails && (
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Autofetching...
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Quote: <span className="font-mono font-bold text-foreground">{quote.quotationCode}</span> • Premium: <span className="font-bold text-primary">₹{Number(quote.totalPremium || 0).toLocaleString('en-IN')}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
          {/* Section 1: Customer & KYC Details */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <UserCheck className="h-4 w-4 text-primary" />
                <span>Customer & Statutory KYC Verification</span>
              </div>
              {customerPan ? (
                <span className="text-[9px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  ✓ KYC Available
                </span>
              ) : (
                <span className="text-[9px] text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  Customer PAN Required
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Customer Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Rajesh Sharma"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">
                  Customer PAN / KYC <span className="text-muted-foreground font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  value={customerPan}
                  onChange={(e) => setCustomerPan(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section: POS Partner Attribution (DEC-02 & DEC-03) */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Users className="h-4 w-4 text-emerald-600" />
                <span>
                  POS Partner Attribution <span className="text-emerald-600 font-bold">* (Mandatory DEC-02)</span>
                </span>
              </div>
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                1:1 Insurer Association
              </span>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                Attributed POS Partner *
              </label>
              {isLoadingPos ? (
                <div className="text-xs text-muted-foreground flex items-center gap-2 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading eligible POS partners for {quote.insurerName}...
                </div>
              ) : posPartners.length > 0 ? (
                <select
                  value={posPartnerId}
                  onChange={(e) => setPosPartnerId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                  required
                >
                  <option value="">Select Eligible POS Partner...</option>
                  {posPartners.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.posCode} • {p.name} ({p.partnerType}) — Mapped: {p.insurerMapping?.insurer?.name || quote.insurerName}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span>⚠️ No Eligible POS Partner Found</span>
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    No active POS Partner is currently mapped to <strong>{quote.insurerName}</strong> with an approved commercial agreement for MOTOR insurance. Please map an eligible partner or select an authorized agent before issuing this policy.
                  </p>
                  <div className="pt-1">
                    <a href="/admin/pos-partners" target="_blank" rel="noreferrer" className="inline-flex items-center text-xs font-bold underline text-primary hover:text-primary/80">
                      Manage POS Partners & Commission Agreements →
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section: Structured Customer Address (DEC-06) */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <UserCheck className="h-4 w-4 text-primary" />
                <span>
                  Customer Structured Address <span className="text-rose-500 font-bold">* (Mandatory DEC-06)</span>
                </span>
              </div>
              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                IRDAI Policy Address
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  placeholder="Plot/Flat, Building Name, Street"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Locality, Landmark"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  City *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mumbai"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  State *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra"
                  value={stateName}
                  onChange={(e) => setStateName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  PIN Code (6 digits) *
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="400001"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background focus:ring-1 focus:ring-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Country
                </label>
                <input
                  type="text"
                  disabled
                  value="India"
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-muted text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Policy Identification */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <FileCheck className="h-4 w-4 text-primary" />
              <span>Policy Number & Effective Period</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Policy Number (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Auto-generated if blank"
                  value={policyNumber}
                  onChange={(e) => setPolicyNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  required
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
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Missing Vehicle Information */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <Car className="h-4 w-4 text-primary" />
                <span>Vehicle Technical Specifications</span>
              </div>
              <span className="text-[9px] text-amber-600 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Chassis & Engine Required
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Registration Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. KA22M1234 or NEW"
                  value={regNumber}
                  onChange={(e) => setRegNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Make & Model
                </label>
                <input
                  type="text"
                  placeholder="e.g. Maruti Suzuki Swift VXI"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">
                  Engine Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. K12M1234567"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">
                  Chassis Number (VIN) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MA3EJE12S00123456"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-mono font-bold bg-background uppercase focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Manufacture Year / Month
                </label>
                <input
                  type="text"
                  placeholder="MM/YYYY (e.g. 05/2023)"
                  value={yearMonth}
                  onChange={(e) => setYearMonth(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Nominee Details */}
          <div className="p-4 rounded-xl border bg-card shadow-xs space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground">
              <UserCheck className="h-4 w-4 text-primary" />
              <span>Nominee Details (Statutory Requirement)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold uppercase text-foreground mb-1">
                  Nominee Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Full legal name"
                  value={nomineeName}
                  onChange={(e) => setNomineeName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Relationship
                </label>
                <select
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                >
                  <option value="Spouse">Spouse</option>
                  <option value="Son">Son</option>
                  <option value="Daughter">Daughter</option>
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Brother">Brother</option>
                  <option value="Sister">Sister</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-muted-foreground mb-1">
                  Nominee Age
                </label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={nomineeAge}
                  onChange={(e) => setNomineeAge(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs font-semibold bg-background focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Mandatory Policy Schedule PDF Document (REQ-2) */}
          <div
            className={`p-4 rounded-xl border bg-card shadow-xs space-y-3 transition-all ${
              pdfError
                ? 'border-rose-500 bg-rose-500/5 ring-2 ring-rose-500/20'
                : policyPdfFile
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <FileText className={`h-4 w-4 ${policyPdfFile ? 'text-emerald-600' : 'text-rose-500'}`} />
                <span>
                  Official Policy Schedule PDF <span className="text-rose-500 font-bold">* (Mandatory)</span>
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                Required by IRDAI
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Under insurance underwriting rules, a policy cannot be completed or legally issued without the official signed policy schedule attached in PDF format.
            </p>

            <div
              className={`p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                policyPdfFile
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : pdfError
                  ? 'border-rose-500 bg-rose-500/10 hover:bg-rose-500/15'
                  : 'border-border hover:border-primary bg-muted/20'
              }`}
              onClick={() => pdfInputRef.current?.click()}
            >
              <input
                type="file"
                ref={pdfInputRef}
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    if (!f.name.toLowerCase().endsWith('.pdf') && f.type !== 'application/pdf') {
                      toast.error('Only PDF documents are supported for official policy schedule');
                      setPdfError('Only PDF files are accepted');
                      return;
                    }
                    setPolicyPdfFile(f);
                    setPdfError(null);
                  }
                }}
              />
              {policyPdfFile ? (
                <div className="flex items-center justify-between w-full px-2">
                  <div className="flex items-center gap-2.5">
                    <FileCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                    <div className="text-left">
                      <div className="text-xs font-bold text-foreground">{policyPdfFile.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {(policyPdfFile.size / 1024).toFixed(1)} KB • Ready for issuance
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPolicyPdfFile(null);
                    }}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center py-2">
                  <Upload className={`h-6 w-6 mx-auto mb-1 ${pdfError ? 'text-rose-500' : 'text-muted-foreground'}`} />
                  <div className="text-xs font-bold text-foreground">Click to upload or drag & drop Policy PDF <span className="text-rose-500">*</span></div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">PDF format only, maximum 15MB</div>
                </div>
              )}
            </div>

            {pdfError && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold pt-1">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{pdfError}</span>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-xs font-black shadow-md transition-all ${
                !policyPdfFile
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              } disabled:opacity-50`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Issuing Policy...
                </>
              ) : !policyPdfFile ? (
                <>
                  <Upload className="h-4 w-4" />
                  Upload Policy PDF to Issue
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Issue Policy Now
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
