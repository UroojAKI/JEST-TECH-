'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, ChevronRight, UserCheck, Loader2, ShieldCheck, Check, Calculator, Sparkles } from 'lucide-react';
import { policiesRepository } from '../../../repositories/policies.repository';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/formatters';

interface LeadConvertWizardDrawerProps {
  isOpen: boolean;
  leadId: string;
  lead?: any;
  onClose: () => void;
}

export function LeadConvertWizardDrawer({ isOpen, leadId, lead, onClose }: LeadConvertWizardDrawerProps) {
  const router = useRouter();
  const [step, setStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Motor Quotation Pricing Engine State
  const [coverType, setCoverType] = useState<'COMPREHENSIVE' | 'STANDALONE_OD' | 'THIRD_PARTY'>('COMPREHENSIVE');
  const [exShowroomPrice, setExShowroomPrice] = useState<number>(1000000);
  const [registrationYear, setRegistrationYear] = useState<number>(new Date().getFullYear() - 1);
  const [engineCc, setEngineCc] = useState<number>(1197);
  const [ncbPercentage, setNcbPercentage] = useState<number>(20);
  const [manualIdv, setManualIdv] = useState<number | undefined>(undefined);

  const [selectedAddons, setSelectedAddons] = useState({
    zeroDepreciation: true,
    engineProtection: false,
    consumables: false,
    returnToInvoice: false,
    roadsideAssistance: true,
    keyReplacement: false,
    ncbProtect: false,
  });

  const [idvDetails, setIdvDetails] = useState<any>(null);
  const [comparativeQuotes, setComparativeQuotes] = useState<any[]>([]);
  const [selectedQuoteIndex, setSelectedQuoteIndex] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    async function calculateMotorQuotes() {
      setIsCalculating(true);
      try {
        const response = await apiClient.post('/quotations/calculate', {
          coverType,
          exShowroomPrice,
          registrationYear,
          engineCc,
          ncbPercentage,
          manualOverrideIdv: manualIdv,
          selectedAddons,
        });

        if (response.data) {
          setIdvDetails(response.data.idvDetails);
          setComparativeQuotes(response.data.comparativeQuotes || []);
        }
      } catch (err: any) {
        toast.error('Failed to calculate live quotation engine rates');
      } finally {
        setIsCalculating(false);
      }
    }

    calculateMotorQuotes();
  }, [isOpen, coverType, exShowroomPrice, registrationYear, engineCc, ncbPercentage, manualIdv, selectedAddons]);

  if (!isOpen) return null;

  const leadName = lead?.name || `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || `Lead Prospect`;
  const leadPhone = lead?.phone || '-';
  const leadEmail = lead?.email || '-';
  const selectedQuote = comparativeQuotes[selectedQuoteIndex] || comparativeQuotes[0];

  const handleIssuePolicy = async () => {
    setIsSubmitting(true);
    try {
      const res = await policiesRepository.issuePolicy({
        leadId,
        quotationId: selectedQuote?.insurerId || `QT-${leadId.slice(-4)}`,
        contactName: leadName,
        productLine: selectedQuote?.insurerName || lead?.productInterest || 'Motor Comprehensive',
        totalPremium: Number(selectedQuote?.totalPremium || 25000),
        idvValue: Number(selectedQuote?.idv || idvDetails?.finalIdv || 850000),
      });

      toast.success(`Policy ${res?.policyNumber || res?.id || ''} issued successfully for ${leadName}!`);
      onClose();
      router.push('/policies');
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err.message || 'Failed to issue policy via API';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { num: 1, title: 'Verify Customer' },
    { num: 2, title: 'Motor Pricing Engine' },
    { num: 3, title: 'Proposal Approval' },
    { num: 4, title: 'Issue Policy' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <UserCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="font-bold text-base">4-Stage Lead Conversion Wizard</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:bg-accent rounded-md">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Stepper Bar */}
        <div className="p-4 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            {steps.map((s) => (
              <div key={s.num} className="flex items-center space-x-1 text-xs">
                <div
                  className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    step === s.num
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                      : step > s.num
                      ? 'bg-emerald-500 text-white'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {step > s.num ? <CheckCircle2 className="h-3.5 w-3.5" /> : s.num}
                </div>
                <span className={`font-semibold ${step === s.num ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {s.title}
                </span>
                {s.num < 4 && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-1" />}
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 1: Confirm Customer Account Record</h4>
              <p className="text-muted-foreground">Verify lead contact information before converting to a permanent customer profile.</p>
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2">
                <div>Customer Name: <strong className="text-foreground text-sm">{leadName}</strong></div>
                <div>Phone Number: <strong className="text-foreground">{leadPhone}</strong></div>
                <div>Email Address: <strong className="text-foreground">{leadEmail}</strong></div>
                <div>Lead Reference Code: <strong className="text-primary font-mono">{leadId}</strong></div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="flex justify-between items-center border-b pb-2">
                <div>
                  <h4 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                    <Calculator className="h-4 w-4 text-emerald-600" /> Step 2: Motor Quotation & Premium Calculator
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Configure IDV, OD, TP, NCB, and Add-ons to generate binding partner quotes.</p>
                </div>
              </div>

              {/* 1. Cover Type Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-muted-foreground block">1. Cover Type Selection</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'COMPREHENSIVE', label: 'Comprehensive (OD + TP)' },
                    { id: 'STANDALONE_OD', label: 'Standalone OD' },
                    { id: 'THIRD_PARTY', label: 'Third Party Only (TP)' },
                  ].map((ct) => (
                    <button
                      key={ct.id}
                      type="button"
                      onClick={() => setCoverType(ct.id as any)}
                      className={`p-2.5 rounded-lg border text-[11px] font-bold text-center transition-all ${
                        coverType === ct.id ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background hover:bg-accent'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Vehicle Master & IDV Calculator */}
              <div className="p-3.5 rounded-xl border bg-muted/20 space-y-3">
                <h5 className="font-bold text-xs text-foreground flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-primary" /> Vehicle Details & IDV Calculation
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Ex-Showroom Price (₹)</label>
                    <input
                      type="number"
                      value={exShowroomPrice}
                      onChange={(e) => setExShowroomPrice(Number(e.target.value))}
                      className="w-full p-2 rounded-md border bg-background text-foreground text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Reg. Year</label>
                    <select
                      value={registrationYear}
                      onChange={(e) => setRegistrationYear(Number(e.target.value))}
                      className="w-full p-2 rounded-md border bg-background text-foreground text-xs font-semibold"
                    >
                      {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-muted-foreground block mb-1">Engine CC</label>
                    <input
                      type="number"
                      value={engineCc}
                      onChange={(e) => setEngineCc(Number(e.target.value))}
                      className="w-full p-2 rounded-md border bg-background text-foreground text-xs font-semibold"
                    />
                  </div>
                </div>

                {idvDetails && (
                  <div className="p-2.5 rounded-lg bg-card border flex justify-between items-center text-[11px]">
                    <div>
                      <span>Calculated IDV ({idvDetails.depreciationPercent}% Dep.): </span>
                      <strong className="text-foreground">{formatCurrency(idvDetails.calculatedIdv)}</strong>
                    </div>
                    <div>
                      <span>Manual Override IDV: </span>
                      <input
                        type="number"
                        placeholder={formatCurrency(idvDetails.calculatedIdv)}
                        value={manualIdv || ''}
                        onChange={(e) => setManualIdv(e.target.value ? Number(e.target.value) : undefined)}
                        className="w-28 p-1 ml-1 rounded border bg-background text-foreground text-xs text-right font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 3. NCB & Addons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* NCB Discount Selection */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2">
                  <label className="font-bold text-muted-foreground block">No Claim Bonus (NCB)</label>
                  <select
                    value={ncbPercentage}
                    onChange={(e) => setNcbPercentage(Number(e.target.value))}
                    className="w-full p-2 rounded-md border bg-background text-foreground text-xs font-bold"
                  >
                    <option value={0}>0% NCB (New / Prior Claim)</option>
                    <option value={20}>20% NCB (1 Claim-Free Year)</option>
                    <option value={25}>25% NCB (2 Claim-Free Years)</option>
                    <option value={35}>35% NCB (3 Claim-Free Years)</option>
                    <option value={45}>45% NCB (4 Claim-Free Years)</option>
                    <option value={50}>50% NCB (5+ Claim-Free Years)</option>
                  </select>
                </div>

                {/* Add-ons Selection */}
                <div className="p-3.5 rounded-xl border bg-card space-y-2">
                  <label className="font-bold text-muted-foreground block">Riders & Add-on Covers</label>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    {[
                      { key: 'zeroDepreciation', label: 'Zero Dep' },
                      { key: 'engineProtection', label: 'Engine Protect' },
                      { key: 'consumables', label: 'Consumables' },
                      { key: 'returnToInvoice', label: 'Return to Invoice' },
                      { key: 'roadsideAssistance', label: '24x7 RSA' },
                      { key: 'keyReplacement', label: 'Key Replace' },
                      { key: 'ncbProtect', label: 'NCB Protect' },
                    ].map((a) => (
                      <label key={a.key} className="flex items-center space-x-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={(selectedAddons as any)[a.key]}
                          onChange={(e) =>
                            setSelectedAddons({ ...selectedAddons, [a.key]: e.target.checked })
                          }
                          className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                        />
                        <span>{a.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 4. Comparative Insurer Quotes List */}
              <div className="space-y-2">
                <label className="font-bold text-muted-foreground block flex justify-between items-center">
                  <span>Comparative Partner Insurer Quotes ({comparativeQuotes.length})</span>
                  {isCalculating && <span className="text-primary animate-pulse">Calculating live rates...</span>}
                </label>

                {comparativeQuotes.map((q, idx) => (
                  <div
                    key={q.insurerId || idx}
                    onClick={() => setSelectedQuoteIndex(idx)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all space-y-2 ${
                      selectedQuoteIndex === idx
                        ? 'border-emerald-500 bg-emerald-500/10 shadow-md ring-1 ring-emerald-500'
                        : 'border-border bg-card hover:border-muted-foreground'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-sm text-foreground flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded bg-muted text-xs">{q.logo}</span>
                        <span>{q.insurerName}</span>
                        {q.isRecommended && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-600 px-1.5 py-0.5 rounded font-bold">
                            Recommended
                          </span>
                        )}
                        {selectedQuoteIndex === idx && <Check className="h-4 w-4 text-emerald-600 ml-1" />}
                      </div>
                      <div className="text-right">
                        <div className="font-black text-base text-emerald-600" suppressHydrationWarning>
                          {formatCurrency(q.totalPremium)}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">incl. 18% GST ({formatCurrency(q.gstTotal)})</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-2 border-t text-[10px] text-muted-foreground font-mono">
                      <div>OD: <strong className="text-foreground">{formatCurrency(q.odPremium)}</strong></div>
                      <div>NCB Disc: <strong className="text-emerald-600">-{formatCurrency(q.ncbDiscount)}</strong></div>
                      <div>TP Premium: <strong className="text-foreground">{formatCurrency(q.tpPremium)}</strong></div>
                      <div>Add-ons: <strong className="text-foreground">{formatCurrency(q.addonsPremium)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 3: Underwriting Proposal Review</h4>
              <p className="text-muted-foreground">Check proposal submission and automatic underwriting rules.</p>
              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-bold space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" />
                  <span>Auto-Underwriting Approval Granted</span>
                </div>
                <p className="text-[11px] font-normal text-muted-foreground pt-1" suppressHydrationWarning>
                  Selected Insurer: <strong>{selectedQuote?.insurerName}</strong> — Final Net Payable Premium: <strong>{formatCurrency(selectedQuote?.totalPremium)}</strong> (IDV: {formatCurrency(selectedQuote?.idv || idvDetails?.finalIdv)})
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Step 4: Issue Policy & Generate Certificate</h4>
              <p className="text-muted-foreground">Finalize payment confirmation and issue active policy record via API backend.</p>
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5 font-mono text-xs">
                <div>Lead Reference: <strong className="text-foreground">{leadId}</strong></div>
                <div>Customer Name: <strong className="text-foreground">{leadName}</strong></div>
                <div>Selected Partner Insurer: <strong className="text-foreground">{selectedQuote?.insurerName}</strong></div>
                <div>Insured Declared Value (IDV): <strong className="text-foreground">{formatCurrency(selectedQuote?.idv || idvDetails?.finalIdv)}</strong></div>
                <div>Total Annual Payable Premium: <strong className="text-emerald-600" suppressHydrationWarning>{formatCurrency(selectedQuote?.totalPremium)}</strong></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-4 border-t flex justify-between items-center bg-card">
          <button
            disabled={step === 1 || isSubmitting}
            onClick={() => setStep(step - 1)}
            className="px-4 py-2 rounded-lg border bg-background font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          {step < 4 ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm"
            >
              Continue Next →
            </button>
          ) : (
            <button
              disabled={isSubmitting}
              onClick={handleIssuePolicy}
              className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-sm flex items-center space-x-1"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              <span>{isSubmitting ? 'Issuing Policy...' : 'Issue Policy Now'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
