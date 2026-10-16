'use client';

import React, { useState } from 'react';
import { X, FileText, ArrowRight, Calculator, Loader2 } from 'lucide-react';
import { useEndorsements } from '../../../hooks/useEndorsements';
import { endorsementsRepository } from '../../../repositories/endorsements.repository';
import { toast } from 'sonner';

interface EndorsementRequestDrawerProps {
  isOpen: boolean;
  policyId: string;
  onClose: () => void;
}

export function EndorsementRequestDrawer({ isOpen, policyId, onClose }: EndorsementRequestDrawerProps) {
  const [category, setCategory] = useState<'NON_FINANCIAL' | 'FINANCIAL'>('NON_FINANCIAL');
  const [type, setType] = useState<string>('ADDRESS_CHANGE');
  const [reason, setReason] = useState<string>('');

  // Structured change fields
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [pincode, setPincode] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const [nomineeName, setNomineeName] = useState('');
  const [nomineeRelation, setNomineeRelation] = useState('');
  const [nomineePercentage, setNomineePercentage] = useState('100');

  const [registrationNumber, setRegistrationNumber] = useState('');
  const [engineNumber, setEngineNumber] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');

  const [newAnnualPremium, setNewAnnualPremium] = useState<string>('');
  const [proRataPreview, setProRataPreview] = useState<any>(null);
  const [isCalculatingProRata, setIsCalculatingProRata] = useState(false);

  const [newContactId, setNewContactId] = useState('');
  const [hasNcbCert, setHasNcbCert] = useState(false);

  const { createEndorsement, isCreating } = useEndorsements();

  if (!isOpen) return null;

  const handleCalculateProRata = async () => {
    const val = Number(newAnnualPremium);
    if (!val || val <= 0) {
      toast.error('Enter a valid positive annual premium amount');
      return;
    }
    setIsCalculatingProRata(true);
    try {
      const res = await endorsementsRepository.calculateProRata(policyId, val);
      setProRataPreview(res);
      toast.success('Pro-rata differential calculated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to calculate pro-rata premium');
    } finally {
      setIsCalculatingProRata(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error('Please enter a reason for the endorsement request');
      return;
    }

    const requestedChanges: Record<string, any> = {};

    if (type === 'ADDRESS_CHANGE') {
      if (address) requestedChanges.address = address;
      if (city) requestedChanges.city = city;
      if (stateVal) requestedChanges.state = stateVal;
      if (pincode) requestedChanges.pincode = pincode;
    } else if (type === 'CONTACT_CHANGE') {
      if (firstName) requestedChanges.firstName = firstName;
      if (lastName) requestedChanges.lastName = lastName;
      if (phone) requestedChanges.phone = phone;
      if (email) requestedChanges.email = email;
    } else if (type === 'NOMINEE_CHANGE') {
      if (nomineeName) requestedChanges.firstName = nomineeName;
      if (nomineeRelation) requestedChanges.relation = nomineeRelation;
      if (nomineePercentage) requestedChanges.percentage = Number(nomineePercentage);
    } else if (type === 'VEHICLE_CHANGE') {
      if (registrationNumber) requestedChanges.registrationNumber = registrationNumber.toUpperCase().trim();
      if (engineNumber) requestedChanges.engineNumber = engineNumber.toUpperCase().trim();
      if (chassisNumber) requestedChanges.chassisNumber = chassisNumber.toUpperCase().trim();
    } else if (type === 'PREMIUM_CHANGE') {
      requestedChanges.newAnnualPremium = Number(newAnnualPremium);
    } else if (type === 'OWNER_TRANSFER') {
      if (newContactId) requestedChanges.newContactId = newContactId;
      requestedChanges.ncbRetentionCertificate = hasNcbCert;
      requestedChanges.transferDate = new Date().toISOString();
    }

    createEndorsement(
      { policyId, type, reason, requestedChanges },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-bold text-base">Request Policy Endorsement</h2>
              <p className="text-[10px] text-muted-foreground">Draft alteration request; requires back-office approval before applying</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {/* Category Toggle */}
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Endorsement Category</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory('NON_FINANCIAL');
                  setType('ADDRESS_CHANGE');
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-colors ${
                  category === 'NON_FINANCIAL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                }`}
              >
                Non-Financial (Details / Nominee)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('FINANCIAL');
                  setType('PREMIUM_CHANGE');
                }}
                className={`flex-1 py-2 rounded-lg font-bold text-xs border transition-colors ${
                  category === 'FINANCIAL' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'
                }`}
              >
                Financial (Premium / Transfer)
              </button>
            </div>
          </div>

          {/* Endorsement Type Select */}
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Endorsement Type</label>
            {category === 'NON_FINANCIAL' ? (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold"
              >
                <option value="ADDRESS_CHANGE">Address & Location Update</option>
                <option value="CONTACT_CHANGE">Contact & Personal Details (Name, Phone, Email)</option>
                <option value="NOMINEE_CHANGE">Nominee & Beneficiary Update</option>
                <option value="VEHICLE_CHANGE">Vehicle Identifiers (Plate, Engine, Chassis)</option>
              </select>
            ) : (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold"
              >
                <option value="PREMIUM_CHANGE">Premium Correction / Pro-Rata Recalculation</option>
                <option value="OWNER_TRANSFER">Vehicle Ownership Transfer</option>
                <option value="IDV_CHANGE">IDV Revision / Adjustment</option>
                <option value="NCB_CHANGE">NCB Correction / Retention</option>
                <option value="COVERAGE_CHANGE">Add-on Coverage Alteration</option>
              </select>
            )}
          </div>

          {/* Dynamic Requested Changes Form Fields */}
          {type === 'ADDRESS_CHANGE' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Proposed New Address Details</span>
              <input
                type="text"
                placeholder="Street Address / Door No"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full p-2 rounded-lg border bg-background"
              />
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
                <input
                  type="text"
                  placeholder="State"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
                <input
                  type="text"
                  placeholder="Pincode"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
              </div>
            </div>
          )}

          {type === 'CONTACT_CHANGE' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Proposed Contact Updates</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
                <input
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Mobile Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
                <input
                  type="email"
                  placeholder="Email Address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
              </div>
            </div>
          )}

          {type === 'NOMINEE_CHANGE' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Proposed Nominee Details</span>
              <input
                type="text"
                placeholder="Nominee Full Name"
                value={nomineeName}
                onChange={(e) => setNomineeName(e.target.value)}
                className="w-full p-2 rounded-lg border bg-background"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Relation (e.g. Spouse, Son)"
                  value={nomineeRelation}
                  onChange={(e) => setNomineeRelation(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
                <input
                  type="number"
                  placeholder="Share % (100)"
                  value={nomineePercentage}
                  onChange={(e) => setNomineePercentage(e.target.value)}
                  className="p-2 rounded-lg border bg-background"
                />
              </div>
            </div>
          )}

          {type === 'VEHICLE_CHANGE' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Proposed Vehicle Identifiers</span>
              <input
                type="text"
                placeholder="Registration Plate (e.g. KA-01-AB-1234)"
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                className="w-full p-2 rounded-lg border bg-background uppercase font-mono"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Engine Number"
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value)}
                  className="p-2 rounded-lg border bg-background uppercase font-mono"
                />
                <input
                  type="text"
                  placeholder="Chassis Number"
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value)}
                  className="p-2 rounded-lg border bg-background uppercase font-mono"
                />
              </div>
            </div>
          )}

          {type === 'PREMIUM_CHANGE' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Proposed New Annual Premium</span>
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="New Annual Premium (₹)"
                  value={newAnnualPremium}
                  onChange={(e) => setNewAnnualPremium(e.target.value)}
                  className="flex-1 p-2 rounded-lg border bg-background font-mono font-bold"
                  min="100"
                />
                <button
                  type="button"
                  onClick={handleCalculateProRata}
                  disabled={isCalculatingProRata}
                  className="px-3 py-2 rounded-lg bg-secondary text-secondary-foreground font-bold text-xs flex items-center gap-1 hover:bg-secondary/80"
                >
                  {isCalculatingProRata ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Calculator className="h-3.5 w-3.5" />}
                  <span>Calculate Pro-Rata</span>
                </button>
              </div>

              {proRataPreview && (
                <div className="p-2.5 rounded-lg border bg-card text-xs space-y-1 font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Remaining Coverage Days:</span>
                    <span className="font-bold text-foreground">{proRataPreview.remainingDays} / {proRataPreview.totalDays}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Pro-Rata Net Differential:</span>
                    <span className="font-bold text-foreground">₹{proRataPreview.proRataNetDifferential?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST (18%):</span>
                    <span className="font-bold text-foreground">₹{proRataPreview.gstAmount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border font-bold text-primary">
                    <span>Total Pro-Rata Payable:</span>
                    <span>₹{proRataPreview.totalPayable?.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {type === 'OWNER_TRANSFER' && (
            <div className="p-3.5 rounded-xl border bg-muted/30 space-y-3">
              <span className="font-bold text-[11px] text-foreground">Ownership Transfer Specifications</span>
              <input
                type="text"
                placeholder="New Owner / Customer ID"
                value={newContactId}
                onChange={(e) => setNewContactId(e.target.value)}
                className="w-full p-2 rounded-lg border bg-background"
              />
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasNcbCert}
                  onChange={(e) => setHasNcbCert(e.target.checked)}
                  className="rounded border-input text-primary focus:ring-primary"
                />
                <span>NCB Reserving / Retention Certificate Attached (Avoids 0% NCB Reset)</span>
              </label>
            </div>
          )}

          {/* Reason & Servicing Details */}
          <div className="space-y-1.5">
            <label className="font-bold text-muted-foreground uppercase">Reason & Servicing Details</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the endorsement rationale and attach supporting document references..."
              className="w-full p-2.5 rounded-lg border bg-background text-xs"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isCreating}
            className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            <span>Submit Endorsement for Review</span>
          </button>
        </form>
      </div>
    </div>
  );
}
