'use client';

import React, { useState, useEffect } from 'react';
import { X, Loader2, ShieldCheck, FileCheck, Car, UserCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';

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

    setIsSubmitting(true);
    try {
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
      };

      const res = await apiClient.post(`/motor/quotes/${quote.id}/issue`, payload);
      const policy = res.data;
      toast.success(`Policy ${policy.policyNumber || policyNumber} issued successfully!`);
      onSuccess(policy);
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Failed to issue policy';
      toast.error(Array.isArray(msg) ? msg.join(' | ') : msg);
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
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Issuing Policy...
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
