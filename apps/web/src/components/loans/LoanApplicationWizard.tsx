'use client';

import React, { useState, useMemo } from 'react';
import {
  Home,
  Building,
  User,
  Briefcase,
  Car,
  GraduationCap,
  Coins,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  ChevronLeft,
  Calculator,
  Plus,
  Trash2,
  Loader2,
  FileText,
  Percent,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  LoanCategory,
  LoanFacilityType,
  LoanPartyRole,
  loansRepository,
  CreateLoanCasePayload,
} from '../../repositories/loans.repository';
import {
  LOAN_CATEGORIES,
  CATEGORY_FORM_FIELDS,
  FieldDefinition,
} from './loanFormConfig';

interface LoanApplicationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newCaseId: string) => void;
}

interface CoApplicantState {
  role: LoanPartyRole;
  firstName: string;
  lastName: string;
  relationshipWithApplicant: string;
  phone: string;
  email: string;
  panNumber: string;
  employmentType: string;
  monthlyIncome: number;
}

const STEPS = [
  { id: 1, title: 'Applicant Profile' },
  { id: 2, title: 'Category & Asset' },
  { id: 3, title: 'Facility & Terms' },
  { id: 4, title: 'Co-Applicants' },
  { id: 5, title: 'Review & Submit' },
];

export function LoanApplicationWizard({
  isOpen,
  onClose,
  onSuccess,
}: LoanApplicationWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Applicant Profile
  const [applicant, setApplicant] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    employmentType: 'SALARIED',
    grossMonthlyIncome: '',
    netMonthlyIncome: '',
    existingTotalEmiObligations: '',
    creditScore: '',
  });

  // Step 2: Category & Asset
  const [category, setCategory] = useState<LoanCategory>('HOME_LOAN');
  const [categoryData, setCategoryData] = useState<Record<string, any>>({});

  // Step 3: Facility
  const [facilityType, setFacilityType] = useState<LoanFacilityType>('NEW_TERM_LOAN');
  const [requestedAmount, setRequestedAmount] = useState<string>('2500000');
  const [requestedTenureMonths, setRequestedTenureMonths] = useState<string>('240');
  const [targetInterestRate, setTargetInterestRate] = useState<string>('8.65');
  const [existingLenderName, setExistingLenderName] = useState<string>('');
  const [existingOutstandingPrincipal, setExistingOutstandingPrincipal] = useState<string>('');
  const [existingEmi, setExistingEmi] = useState<string>('');
  const [existingTenureRemainingMonths, setExistingTenureRemainingMonths] = useState<string>('');
  const [requestedTopUpAmount, setRequestedTopUpAmount] = useState<string>('');

  // Step 4: Co-Applicants
  const [coApplicants, setCoApplicants] = useState<CoApplicantState[]>([]);

  // Step 5: Notes
  const [internalNotes, setInternalNotes] = useState('');

  // Live Calculations
  const calculatedEmi = useMemo(() => {
    const p = parseFloat(requestedAmount) || 0;
    const r = parseFloat(targetInterestRate) || 0;
    const n = parseInt(requestedTenureMonths) || 0;
    return loansRepository.calculateEmi(p, r, n);
  }, [requestedAmount, targetInterestRate, requestedTenureMonths]);

  const foirRatio = useMemo(() => {
    const netIncome = parseFloat(applicant.netMonthlyIncome) || 0;
    const currentEmis = parseFloat(applicant.existingTotalEmiObligations) || 0;
    if (netIncome <= 0) return null;
    const totalObligations = currentEmis + calculatedEmi;
    return Math.round((totalObligations / netIncome) * 100);
  }, [applicant.netMonthlyIncome, applicant.existingTotalEmiObligations, calculatedEmi]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep === 1) {
      if (!applicant.firstName.trim() || !applicant.phone.trim()) {
        toast.error('First Name and Phone Number are required');
        return;
      }
      if (applicant.phone.replace(/\D/g, '').length !== 10) {
        toast.error('Please enter a valid 10-digit mobile number');
        return;
      }
      if (applicant.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i.test(applicant.panNumber)) {
        toast.error('Invalid PAN format (e.g. ABCDE1234F)');
        return;
      }
    }

    if (currentStep === 2) {
      const fields = CATEGORY_FORM_FIELDS[category] || [];
      for (const field of fields) {
        if (field.required && !categoryData[field.name]) {
          toast.error(`Please provide ${field.label}`);
          return;
        }
      }
    }

    if (currentStep === 3) {
      const amount = parseFloat(requestedAmount);
      const tenure = parseInt(requestedTenureMonths);
      if (!amount || amount <= 0) {
        toast.error('Please specify a valid requested loan amount');
        return;
      }
      if (!tenure || tenure <= 0) {
        toast.error('Please specify valid tenure in months');
        return;
      }
      if (facilityType === 'BALANCE_TRANSFER' && !existingLenderName) {
        toast.error('Please specify existing lender for Balance Transfer');
        return;
      }
    }

    setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const addCoApplicant = () => {
    setCoApplicants([
      ...coApplicants,
      {
        role: 'CO_APPLICANT',
        firstName: '',
        lastName: '',
        relationshipWithApplicant: 'SPOUSE',
        phone: '',
        email: '',
        panNumber: '',
        employmentType: 'SALARIED',
        monthlyIncome: 0,
      },
    ]);
  };

  const updateCoApplicant = (index: number, updates: Partial<CoApplicantState>) => {
    const updated = [...coApplicants];
    updated[index] = { ...updated[index], ...updates };
    setCoApplicants(updated);
  };

  const removeCoApplicant = (index: number) => {
    setCoApplicants(coApplicants.filter((_, i) => i !== index));
  };

  const sanitizeNumber = (val: any) => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const cleaned = String(val).replace(/,/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // 1. Resolve or create customer contact (safe fallback)
      let contactId: string | undefined = undefined;
      try {
        const resolved = await loansRepository.resolveOrCreateContact({
          firstName: applicant.firstName.trim(),
          lastName: applicant.lastName.trim() || undefined,
          phone: applicant.phone.replace(/\D/g, ''),
          email: applicant.email.trim() || undefined,
          panNumber: applicant.panNumber.trim().toUpperCase() || undefined,
          aadhaarNumber: applicant.aadhaarNumber.trim() || undefined,
        });
        if (resolved) contactId = resolved;
      } catch {
        // Backend self-heals using applicant profile
      }

      const monthly =
        sanitizeNumber(applicant.netMonthlyIncome) ||
        sanitizeNumber(applicant.grossMonthlyIncome) ||
        50000;
      const annual = monthly * 12;

      let normalizedFacilityType: LoanFacilityType = facilityType;
      if ((facilityType as string) === 'OVERDRAFT' || (facilityType as string) === 'DROP_LINE_OD') {
        normalizedFacilityType = 'OVERDRAFT_CASH_CREDIT';
      }

      const payload: CreateLoanCasePayload = {
        ...(contactId ? { contactId } : {}),
        applicant: {
          firstName: applicant.firstName.trim() || 'Borrower',
          lastName: applicant.lastName.trim() || undefined,
          phone: applicant.phone.replace(/\D/g, ''),
          email: applicant.email.trim() || undefined,
          panNumber: applicant.panNumber.trim().toUpperCase() || undefined,
          aadhaarNumber: applicant.aadhaarNumber.trim() || undefined,
        },
        category,
        occupationType: applicant.employmentType || 'SALARIED',
        employerBusinessName: categoryData.companyName || categoryData.builderName || 'Self / Business',
        monthlyIncome: monthly,
        annualIncome: annual,
        existingEmiObligations: sanitizeNumber(applicant.existingTotalEmiObligations),
        cibilScore: applicant.creditScore ? parseInt(String(applicant.creditScore).replace(/\D/g, ''), 10) : undefined,
        categoryData,
        facility: {
          facilityType: normalizedFacilityType,
          requestedAmount: sanitizeNumber(requestedAmount) || 100000,
          tenureMonths: parseInt(String(requestedTenureMonths).replace(/\D/g, ''), 10) || 60,
          targetRoiPercentage: targetInterestRate ? sanitizeNumber(targetInterestRate) : undefined,
          existingLenderName: existingLenderName.trim() || undefined,
          outstandingAmount: existingOutstandingPrincipal ? sanitizeNumber(existingOutstandingPrincipal) : undefined,
          topUpAmountRequested: requestedTopUpAmount ? sanitizeNumber(requestedTopUpAmount) : undefined,
        },
        parties: coApplicants.map((ca) => ({
          role: ca.role,
          name: `${ca.firstName.trim()} ${ca.lastName.trim()}`.trim(),
          relationship: ca.relationshipWithApplicant,
          mobileNumber: ca.phone.replace(/\D/g, ''),
          email: ca.email.trim() || undefined,
          panNumber: ca.panNumber.trim().toUpperCase() || undefined,
          occupation: ca.employmentType,
          monthlyIncome: sanitizeNumber(ca.monthlyIncome),
        })),
      };

      const res = await loansRepository.createCase(payload);
      toast.success(`Loan case ${res.caseCode} registered successfully!`);
      onSuccess(res.id);
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to submit loan enquiry';
      toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/40">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <Building className="h-5 w-5" />
              </span>
              New Loan Application Enquiry
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Multi-category retail and commercial lending proposal intake
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Progress Tracker */}
        <div className="border-b border-border px-6 py-3 bg-muted/20">
          <div className="flex items-center justify-between">
            {STEPS.map((step) => {
              const isPassed = currentStep > step.id;
              const isCurrent = currentStep === step.id;
              return (
                <div key={step.id} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors ${
                      isPassed
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isPassed ? '✓' : step.id}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 max-h-[68vh] overflow-y-auto">
          {/* STEP 1: Applicant Profile */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Primary Borrower KYC & Income
                </h3>
                <p className="text-xs text-muted-foreground">
                  Individual / Sole Applicant holding debt responsibility
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">First Name *</label>
                  <input
                    type="text"
                    value={applicant.firstName}
                    onChange={(e) => setApplicant({ ...applicant, firstName: e.target.value })}
                    placeholder="e.g. Ramesh"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Last Name</label>
                  <input
                    type="text"
                    value={applicant.lastName}
                    onChange={(e) => setApplicant({ ...applicant, lastName: e.target.value })}
                    placeholder="e.g. Sharma"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Mobile Phone Number *</label>
                  <input
                    type="tel"
                    maxLength={10}
                    value={applicant.phone}
                    onChange={(e) => setApplicant({ ...applicant, phone: e.target.value.replace(/\D/g, '') })}
                    placeholder="10 digit mobile"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Email Address</label>
                  <input
                    type="email"
                    value={applicant.email}
                    onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
                    placeholder="name@example.com"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">PAN Number</label>
                  <input
                    type="text"
                    maxLength={10}
                    value={applicant.panNumber}
                    onChange={(e) => setApplicant({ ...applicant, panNumber: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F"
                    className="mt-1 w-full px-3 py-2 text-xs font-mono rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Aadhaar / OVD Number</label>
                  <input
                    type="text"
                    maxLength={12}
                    value={applicant.aadhaarNumber}
                    onChange={(e) => setApplicant({ ...applicant, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                    placeholder="12 digit Aadhaar"
                    className="mt-1 w-full px-3 py-2 text-xs font-mono rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Employment Nature</label>
                  <select
                    value={applicant.employmentType}
                    onChange={(e) => setApplicant({ ...applicant, employmentType: e.target.value })}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="SALARIED">Salaried (Private / Govt / MNC)</option>
                    <option value="SELF_EMPLOYED_PROFESSIONAL">Self-Employed Professional (Doctor, CA, Architect)</option>
                    <option value="SELF_EMPLOYED_BUSINESS">Self-Employed Business / Trader</option>
                    <option value="RETIRED">Retired / Pensioner</option>
                    <option value="HOMEMAKER">Homemaker / Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Credit Score (CIBIL / Experian)</label>
                  <input
                    type="number"
                    min={300}
                    max={900}
                    value={applicant.creditScore}
                    onChange={(e) => setApplicant({ ...applicant, creditScore: e.target.value })}
                    placeholder="e.g. 760"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Net Monthly In-Hand Income (₹)</label>
                  <input
                    type="number"
                    value={applicant.netMonthlyIncome}
                    onChange={(e) => setApplicant({ ...applicant, netMonthlyIncome: e.target.value })}
                    placeholder="e.g. 95000"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground">Existing Total Monthly EMI Obligations (₹)</label>
                  <input
                    type="number"
                    value={applicant.existingTotalEmiObligations}
                    onChange={(e) => setApplicant({ ...applicant, existingTotalEmiObligations: e.target.value })}
                    placeholder="e.g. 15000 (0 if none)"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Category & Asset Specifics */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="text-xs font-semibold text-foreground">Select Loan Category</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                  {(Object.keys(LOAN_CATEGORIES) as LoanCategory[]).map((catKey) => {
                    const meta = LOAN_CATEGORIES[catKey];
                    const isSelected = category === catKey;
                    return (
                      <button
                        type="button"
                        key={catKey}
                        onClick={() => {
                          setCategory(catKey);
                          setCategoryData({});
                        }}
                        className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                            : 'border-border hover:border-muted-foreground/40 bg-card'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-foreground">{meta.name}</span>
                            {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                          </div>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">
                            {meta.tagline}
                          </p>
                        </div>
                        <div className="mt-2 text-[10px] text-primary/80 font-medium">
                          {meta.typicalRateRange}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic Category Specific Form */}
              <div className="border border-border/80 rounded-lg p-4 bg-muted/10 space-y-4">
                <div className="border-b border-border/60 pb-2 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    {LOAN_CATEGORIES[category].name} — Asset & Requirement Details
                  </h4>
                  <span className="text-[11px] text-muted-foreground">
                    Required for accurate lender underwriting
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(CATEGORY_FORM_FIELDS[category] || []).map((field: FieldDefinition) => {
                    const val = categoryData[field.name] ?? '';
                    return (
                      <div
                        key={field.name}
                        className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                      >
                        <label className="text-xs font-semibold text-foreground flex items-center gap-1">
                          {field.label} {field.required && <span className="text-destructive">*</span>}
                        </label>

                        {field.type === 'select' && (
                          <select
                            value={val}
                            onChange={(e) =>
                              setCategoryData({ ...categoryData, [field.name]: e.target.value })
                            }
                            className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          >
                            <option value="">-- Select Option --</option>
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        )}

                        {field.type === 'text' && (
                          <input
                            type="text"
                            value={val}
                            onChange={(e) =>
                              setCategoryData({ ...categoryData, [field.name]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        )}

                        {field.type === 'number' && (
                          <input
                            type="number"
                            value={val}
                            onChange={(e) =>
                              setCategoryData({
                                ...categoryData,
                                [field.name]: e.target.value ? parseFloat(e.target.value) : '',
                              })
                            }
                            placeholder={field.placeholder}
                            className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        )}

                        {field.type === 'textarea' && (
                          <textarea
                            rows={2}
                            value={val}
                            onChange={(e) =>
                              setCategoryData({ ...categoryData, [field.name]: e.target.value })
                            }
                            placeholder={field.placeholder}
                            className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        )}

                        {field.type === 'checkbox' && (
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="checkbox"
                              id={field.name}
                              checked={Boolean(val)}
                              onChange={(e) =>
                                setCategoryData({ ...categoryData, [field.name]: e.target.checked })
                              }
                              className="rounded border-input text-primary focus:ring-primary"
                            />
                            <label htmlFor={field.name} className="text-xs text-muted-foreground cursor-pointer">
                              Yes / Confirmed
                            </label>
                          </div>
                        )}

                        {field.helpText && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">{field.helpText}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Facility & Terms */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground">Facility Structure</label>
                  <select
                    value={facilityType}
                    onChange={(e) => setFacilityType(e.target.value as LoanFacilityType)}
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="NEW_TERM_LOAN">New Term Loan</option>
                    <option value="BALANCE_TRANSFER">Balance Transfer (BT)</option>
                    <option value="TOP_UP">Balance Transfer + Top-Up</option>
                    <option value="OVERDRAFT_CASH_CREDIT">Overdraft / Cash Credit (OD/CC)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Requested Loan Amount (₹) *</label>
                  <input
                    type="number"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(e.target.value)}
                    placeholder="e.g. 5000000"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Requested Tenure (Months) *</label>
                  <input
                    type="number"
                    value={requestedTenureMonths}
                    onChange={(e) => setRequestedTenureMonths(e.target.value)}
                    placeholder="e.g. 240 (20 years)"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Approx {Math.round(((parseInt(requestedTenureMonths) || 0) / 12) * 10) / 10} Years
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground">Target / Benchmark Rate (%)</label>
                  <input
                    type="number"
                    step="0.05"
                    value={targetInterestRate}
                    onChange={(e) => setTargetInterestRate(e.target.value)}
                    placeholder="e.g. 8.65"
                    className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Balance Transfer conditional fields */}
              {(facilityType === 'BALANCE_TRANSFER' || facilityType === 'TOP_UP') && (
                <div className="border border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-4 space-y-4">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Existing Loan Takeover Details (Balance Transfer)
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground">Existing Lender / Bank Name *</label>
                      <input
                        type="text"
                        value={existingLenderName}
                        onChange={(e) => setExistingLenderName(e.target.value)}
                        placeholder="e.g. HDFC Bank, SBI, ICICI"
                        className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">Existing Outstanding Principal (₹)</label>
                      <input
                        type="number"
                        value={existingOutstandingPrincipal}
                        onChange={(e) => setExistingOutstandingPrincipal(e.target.value)}
                        placeholder="e.g. 4200000"
                        className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">Current Monthly EMI (₹)</label>
                      <input
                        type="number"
                        value={existingEmi}
                        onChange={(e) => setExistingEmi(e.target.value)}
                        placeholder="e.g. 45000"
                        className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground">Remaining Tenure (Months)</label>
                      <input
                        type="number"
                        value={existingTenureRemainingMonths}
                        onChange={(e) => setExistingTenureRemainingMonths(e.target.value)}
                        placeholder="e.g. 180"
                        className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {facilityType === 'TOP_UP' && (
                      <div className="md:col-span-2">
                        <label className="text-xs font-semibold text-foreground">Requested Top-Up Cashout (₹)</label>
                        <input
                          type="number"
                          value={requestedTopUpAmount}
                          onChange={(e) => setRequestedTopUpAmount(e.target.value)}
                          placeholder="e.g. 800000"
                          className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Financial Indicative Banner */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                    <Calculator className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground font-medium">Indicative Benchmark EMI</div>
                    <div className="text-xl font-black text-foreground">
                      ₹{calculatedEmi.toLocaleString('en-IN')}{' '}
                      <span className="text-xs font-normal text-muted-foreground">/ month</span>
                    </div>
                  </div>
                </div>

                {foirRatio !== null && (
                  <div className="flex items-center gap-3 border-t sm:border-t-0 sm:border-l border-border pt-2 sm:pt-0 sm:pl-4">
                    <div>
                      <div className="text-xs text-muted-foreground font-medium">Estimated FOIR</div>
                      <div
                        className={`text-lg font-bold ${
                          foirRatio > 65
                            ? 'text-destructive'
                            : foirRatio > 50
                            ? 'text-amber-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {foirRatio}%{' '}
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {foirRatio > 65 ? '(High Risk)' : foirRatio > 50 ? '(Moderate)' : '(Optimal)'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Co-Applicants & Guarantors */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Co-Applicants & Guarantors
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Adding co-borrowers clubs income for higher eligibility
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addCoApplicant}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Co-Borrower
                </button>
              </div>

              {coApplicants.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-border rounded-lg bg-muted/10">
                  <User className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium text-foreground">No co-applicants added</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Click &quot;Add Co-Borrower&quot; if this case has a joint owner or guarantor
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {coApplicants.map((ca, idx) => (
                    <div
                      key={idx}
                      className="border border-border rounded-lg p-4 bg-card shadow-sm space-y-3 relative"
                    >
                      <button
                        type="button"
                        onClick={() => removeCoApplicant(idx)}
                        className="absolute top-3 right-3 p-1 rounded hover:bg-destructive/10 text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          Co-Borrower #{idx + 1}
                        </span>
                        <select
                          value={ca.role}
                          onChange={(e) =>
                            updateCoApplicant(idx, { role: e.target.value as LoanPartyRole })
                          }
                          className="px-2 py-1 text-[11px] rounded border border-input bg-background font-medium"
                        >
                          <option value="CO_APPLICANT">Co-Applicant (Income Clubbed)</option>
                          <option value="GUARANTOR">Guarantor</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[11px] font-semibold text-foreground">First Name *</label>
                          <input
                            type="text"
                            value={ca.firstName}
                            onChange={(e) => updateCoApplicant(idx, { firstName: e.target.value })}
                            placeholder="First Name"
                            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-foreground">Last Name</label>
                          <input
                            type="text"
                            value={ca.lastName}
                            onChange={(e) => updateCoApplicant(idx, { lastName: e.target.value })}
                            placeholder="Last Name"
                            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-foreground">Relationship</label>
                          <select
                            value={ca.relationshipWithApplicant}
                            onChange={(e) =>
                              updateCoApplicant(idx, { relationshipWithApplicant: e.target.value })
                            }
                            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                          >
                            <option value="SPOUSE">Spouse</option>
                            <option value="FATHER">Father</option>
                            <option value="MOTHER">Mother</option>
                            <option value="SON">Son</option>
                            <option value="DAUGHTER">Daughter</option>
                            <option value="BROTHER">Brother</option>
                            <option value="BUSINESS_PARTNER">Business Partner / Director</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[11px] font-semibold text-foreground">Mobile Phone</label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={ca.phone}
                            onChange={(e) => updateCoApplicant(idx, { phone: e.target.value.replace(/\D/g, '') })}
                            placeholder="10 digit mobile"
                            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-foreground">PAN Number</label>
                          <input
                            type="text"
                            maxLength={10}
                            value={ca.panNumber}
                            onChange={(e) => updateCoApplicant(idx, { panNumber: e.target.value.toUpperCase() })}
                            placeholder="ABCDE1234F"
                            className="mt-1 w-full px-2.5 py-1.5 text-xs font-mono rounded border border-input bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-semibold text-foreground">Net Monthly Income (₹)</label>
                          <input
                            type="number"
                            value={ca.monthlyIncome || ''}
                            onChange={(e) =>
                              updateCoApplicant(idx, {
                                monthlyIncome: e.target.value ? parseFloat(e.target.value) : 0,
                              })
                            }
                            placeholder="e.g. 50000"
                            className="mt-1 w-full px-2.5 py-1.5 text-xs rounded border border-input bg-background"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (
            <div className="space-y-4">
              <div className="border-b border-border pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  Review Loan Application Summary
                </h3>
                <p className="text-xs text-muted-foreground">
                  Verify details before registering the case into underwriting queue
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                  <div className="text-xs font-bold text-foreground border-b border-border pb-1">
                    Borrower Profile
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Name:</span>{' '}
                      <span className="font-semibold text-foreground">
                        {applicant.firstName} {applicant.lastName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Phone:</span>{' '}
                      <span className="font-mono">{applicant.phone}</span>
                    </div>
                    {applicant.panNumber && (
                      <div>
                        <span className="text-muted-foreground">PAN:</span>{' '}
                        <span className="font-mono">{applicant.panNumber}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Employment:</span>{' '}
                      <span>{applicant.employmentType}</span>
                    </div>
                    {applicant.netMonthlyIncome && (
                      <div>
                        <span className="text-muted-foreground">Monthly Income:</span>{' '}
                        <span>₹{Number(applicant.netMonthlyIncome).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-lg border border-border bg-card space-y-2">
                  <div className="text-xs font-bold text-foreground border-b border-border pb-1">
                    Facility & Loan Terms
                  </div>
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-muted-foreground">Category:</span>{' '}
                      <span className="font-semibold text-foreground">
                        {LOAN_CATEGORIES[category].name}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Facility Type:</span>{' '}
                      <span>{facilityType}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Requested Amount:</span>{' '}
                      <span className="font-bold text-primary">
                        ₹{Number(requestedAmount).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Tenure:</span>{' '}
                      <span>{requestedTenureMonths} Months</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Est. EMI:</span>{' '}
                      <span className="font-semibold">
                        ₹{calculatedEmi.toLocaleString('en-IN')} / mo
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground">
                  Agent / Internal Notes
                </label>
                <textarea
                  rows={3}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Additional background, preferred lenders, disbursement deadlines, or special customer instructions..."
                  className="mt-1 w-full px-3 py-2 text-xs rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
          <button
            type="button"
            onClick={currentStep === 1 ? onClose : handleBack}
            className="px-4 py-2 text-xs font-medium rounded-md border border-border hover:bg-muted text-foreground transition-colors flex items-center gap-1.5"
          >
            <ChevronLeft className="h-4 w-4" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </button>

          {currentStep < STEPS.length ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-5 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 text-xs font-bold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Registering Enquiry...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Submit Loan Enquiry
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
