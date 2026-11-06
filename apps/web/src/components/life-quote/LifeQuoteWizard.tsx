'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ArrowRight,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  Heart,
  Users,
  CheckCircle2,
  FileText,
  Loader2,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { lifeQuotationRepository } from '../../repositories/life-quotation.repository';
import {
  ANNUITY_OPTIONS,
  APPOINTEE_RELATIONS,
  CATEGORY_TO_PRISMA_MAP,
  GENDERS,
  NOMINEE_RELATIONS,
  OCCUPATIONS,
  PLAN_CATEGORIES,
  POLICY_FORMS,
  PROPOSER_RELATIONS,
  SECTION_A_FIELDS,
  SMOKER_STATUSES,
  calculateBmi,
  isJointLifeAnnuity,
  isMinor,
  labelOf,
} from './lifeFormConfig';
import { FieldLabel, LifeFields, YesNo, inputCls } from './LifeFields';

const STEPS = [
  'Proposer & Contact',
  'Plan Category & Parameters',
  'Life Assured & Underwriting',
  'Nominee & Appointee',
  'Review & Submit',
];

export function LifeQuoteWizard({
  contactId: initialContactId,
  leadId,
}: {
  contactId?: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 0: Proposer & Contact State
  const [proposer, setProposer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    dateOfBirth: '',
    gender: 'MALE',
    occupation: 'SALARIED',
    annualIncome: '' as number | '',
    addressLine1: '',
    city: '',
    state: '',
    pincode: '',
  });

  // Step 1: Plan Category & Parameters State
  const [planCategory, setPlanCategory] = useState<string>('TERM_LIFE');
  const [policyForm, setPolicyForm] = useState<string>('NEW_POLICY');
  const [categoryData, setCategoryData] = useState<Record<string, any>>({
    deathBenefitPayoutOption: 'LUMP_SUM',
    terminalIllnessBenefitIncluded: true,
  });

  // Step 2: Life Assured & Underwriting State
  const [isLifeAssuredDifferent, setIsLifeAssuredDifferent] = useState(false);
  const [proposerRelation, setProposerRelation] = useState('SELF');
  const [lifeAssuredName, setLifeAssuredName] = useState('');
  const [lifeAssuredDob, setLifeAssuredDob] = useState('');
  const [lifeAssuredGender, setLifeAssuredGender] = useState('MALE');

  const [smokerStatus, setSmokerStatus] = useState('NON_SMOKER');
  const [heightCm, setHeightCm] = useState<number | ''>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [occupationRiskCategory, setOccupationRiskCategory] = useState('CLASS_1_STANDARD');
  const [hasPreExistingIllness, setHasPreExistingIllness] = useState(false);
  const [medicalHistoryDetails, setMedicalHistoryDetails] = useState('');

  // Secondary Life Assured for Joint Life Annuity
  const [secondaryLife, setSecondaryLife] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: 'FEMALE',
    relationToPrimary: 'SPOUSE',
    hasPreExistingIllness: false,
    medicalNotes: '',
  });

  // Step 3: Nominee & Appointee State
  const [nominee, setNominee] = useState({
    name: '',
    dateOfBirth: '',
    relation: 'SPOUSE',
  });

  const [appointee, setAppointee] = useState({
    name: '',
    dateOfBirth: '',
    relation: 'FATHER',
  });

  // Preload contact if ID passed
  const { data: contactData } = useQuery({
    queryKey: ['life-contact-preload', initialContactId],
    queryFn: () => (initialContactId ? lifeQuotationRepository.getContact(initialContactId) : null),
    enabled: Boolean(initialContactId),
  });

  useEffect(() => {
    if (contactData) {
      setProposer((prev) => ({
        ...prev,
        firstName: contactData.firstName || prev.firstName,
        lastName: contactData.lastName || prev.lastName,
        phone: contactData.phone || prev.phone,
        email: contactData.email || prev.email,
        panNumber: contactData.panNumber || prev.panNumber,
        aadhaarNumber: contactData.aadhaarNumber || prev.aadhaarNumber,
        addressLine1: contactData.addressLine1 || prev.addressLine1,
        city: contactData.city || prev.city,
        state: contactData.state || prev.state,
        pincode: contactData.pincode || prev.pincode,
      }));
    }
  }, [contactData]);

  // Reset categoryData defaults on category switch
  const handleCategoryChange = (newCat: string) => {
    setPlanCategory(newCat);
    const fields = SECTION_A_FIELDS[newCat] || [];
    const defaults: Record<string, any> = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined && f.type !== 'number') {
        defaults[f.key] = f.defaultValue;
      }
    }
    setCategoryData(defaults);
  };

  // Live BMI calculation
  const calculatedBmi = useMemo(() => {
    return calculateBmi(
      typeof weightKg === 'number' ? weightKg : null,
      typeof heightCm === 'number' ? heightCm : null,
    );
  }, [weightKg, heightCm]);

  // Derived Nominee Minor check
  const nomineeIsMinor = useMemo(() => {
    return isMinor(nominee.dateOfBirth);
  }, [nominee.dateOfBirth]);

  // Check if current category requires Joint Life Annuity
  const isJointAnnuity = useMemo(() => {
    return planCategory === 'ANNUITY_PENSION' && isJointLifeAnnuity(categoryData.annuityOption);
  }, [planCategory, categoryData.annuityOption]);

  // Validation per step
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 0) {
      if (!proposer.firstName.trim()) {
        toast.error('Proposer first name is required.');
        return false;
      }
      const cleanPhone = proposer.phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        toast.error('Please enter a valid 10-digit mobile number.');
        return false;
      }
      return true;
    }

    if (currentStep === 1) {
      const fields = SECTION_A_FIELDS[planCategory] || [];
      for (const f of fields) {
        if (f.required && (categoryData[f.key] === undefined || categoryData[f.key] === '')) {
          toast.error(`Please provide ${f.label}`);
          return false;
        }
      }
      return true;
    }

    if (currentStep === 2) {
      if (isLifeAssuredDifferent) {
        if (!lifeAssuredName.trim()) {
          toast.error('Please enter the Life Assured full legal name.');
          return false;
        }
        if (!lifeAssuredDob) {
          toast.error('Please enter the Life Assured date of birth.');
          return false;
        }
      }
      if (!heightCm || !weightKg) {
        toast.error('Height and weight are required for underwriting mortality calculation.');
        return false;
      }
      if (isJointAnnuity) {
        if (!secondaryLife.fullName.trim() || !secondaryLife.dateOfBirth) {
          toast.error('Secondary Life Assured details are mandatory for Joint Life Annuity plans.');
          return false;
        }
      }
      return true;
    }

    if (currentStep === 3) {
      if (!nominee.name.trim()) {
        toast.error('Nominee full legal name is required.');
        return false;
      }
      if (!nominee.dateOfBirth) {
        toast.error('Nominee date of birth is required.');
        return false;
      }
      if (nomineeIsMinor) {
        if (!appointee.name.trim() || !appointee.dateOfBirth) {
          toast.error('Appointee name and date of birth are mandatory because the nominee is a minor (< 18).');
          return false;
        }
        if (isMinor(appointee.dateOfBirth)) {
          toast.error('The designated Appointee must be an adult (at least 18 years of age).');
          return false;
        }
      }
      return true;
    }

    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    try {
      setIsSubmitting(true);

      // 1. Resolve contact or create a new contact
      const contactId =
        initialContactId ||
        (await lifeQuotationRepository.resolveOrCreateContact({
          firstName: proposer.firstName,
          lastName: proposer.lastName,
          phone: proposer.phone,
          email: proposer.email,
          panNumber: proposer.panNumber,
          aadhaarNumber: proposer.aadhaarNumber,
          dateOfBirth: proposer.dateOfBirth,
          gender: proposer.gender,
        }));

      // 2. Prepare Proposal Case Payload matching CreateLifeQuotationCaseDto
      const canonicalPlanCategory = CATEGORY_TO_PRISMA_MAP[planCategory] || planCategory;
      const canonicalPolicyForm = policyForm === 'RENEWAL_PORTABILITY' ? 'RENEWAL' : policyForm;

      const payload: Record<string, any> = {
        contactId,
        leadId: leadId || undefined,
        planCategory: canonicalPlanCategory,
        policyForm: canonicalPolicyForm,
        occupation: proposer.occupation,
        annualIncome: proposer.annualIncome !== '' ? Number(proposer.annualIncome) : undefined,
        address: proposer.addressLine1 ? {
          addressLine1: proposer.addressLine1,
          city: proposer.city,
          state: proposer.state,
          pincode: proposer.pincode,
        } : undefined,
        proposerKyc: {
          panNumber: proposer.panNumber?.trim() ? proposer.panNumber.trim().toUpperCase() : undefined,
          aadhaarNumber: proposer.aadhaarNumber?.trim() ? proposer.aadhaarNumber.trim() : undefined,
          email: proposer.email?.trim() ? proposer.email.trim() : undefined,
        },
        isLifeAssuredDifferent,
        proposerRelation: isLifeAssuredDifferent ? proposerRelation : 'SELF',
        lifeAssuredName: isLifeAssuredDifferent ? lifeAssuredName.trim() : `${proposer.firstName} ${proposer.lastName}`.trim(),
        lifeAssuredDob: (isLifeAssuredDifferent ? lifeAssuredDob : proposer.dateOfBirth) || undefined,
        lifeAssuredGender: isLifeAssuredDifferent ? lifeAssuredGender : proposer.gender,

        // Underwriting Mortality
        smokerStatus,
        heightCm: heightCm !== '' ? Number(heightCm) : undefined,
        weightKg: weightKg !== '' ? Number(weightKg) : undefined,
        occupationRiskCategory,
        hasPreExistingIllness,
        medicalHistoryDetails: hasPreExistingIllness ? medicalHistoryDetails : undefined,

        // Nominee
        nomineeName: nominee.name.trim() || undefined,
        nomineeDob: nominee.dateOfBirth || undefined,
        nomineeRelation: nominee.relation || undefined,

        // Appointee (if minor)
        appointeeName: nomineeIsMinor && appointee.name.trim() ? appointee.name.trim() : undefined,
        appointeeDob: nomineeIsMinor && appointee.dateOfBirth ? appointee.dateOfBirth : undefined,
        appointeeRelation: nomineeIsMinor && appointee.relation ? appointee.relation : undefined,

        // Category-Specific Parameters
        categoryData,
      };

      // Secondary Life Assured for Joint Life
      if (isJointAnnuity && secondaryLife.fullName.trim()) {
        payload.secondaryLifeAssured = {
          name: secondaryLife.fullName.trim(),
          dateOfBirth: secondaryLife.dateOfBirth,
          gender: secondaryLife.gender,
          relationship: secondaryLife.relationToPrimary || 'SPOUSE',
          smokerStatus: 'NON_SMOKER',
          hasPreExistingIllness: secondaryLife.hasPreExistingIllness,
          medicalNotes: secondaryLife.medicalNotes || undefined,
        };
      }

      // 3. Submit proposal case
      const createdCase = await lifeQuotationRepository.createCase(payload);
      toast.success(`Proposal case ${createdCase.caseCode || ''} created successfully!`);
      router.push(`/sales/life-quotations/${createdCase.id}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create Life proposal case');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {/* Back Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/sales/life-quotations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Life Proposals</span>
        </Link>
        <span className="text-[11px] font-mono text-muted-foreground">
          Step {step + 1} of {STEPS.length}
        </span>
      </div>

      {/* Header */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
            Life CRM Engine
          </span>
          <span className="text-xs text-muted-foreground">• New Business Proposal</span>
        </div>
        <h1 className="text-2xl font-black text-foreground">Create Life Insurance Proposal</h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-xl">
          Capture proposer details, underwriting metrics, category-specific terms, and nominee allocations to generate insurer quotes.
        </p>

        {/* Wizard Stepper Tabs */}
        <div className="grid grid-cols-5 gap-2 mt-6">
          {STEPS.map((s, idx) => {
            const isCompleted = idx < step;
            const isCurrent = idx === step;
            return (
              <div
                key={s}
                className={`flex flex-col gap-1 p-2.5 rounded-xl border transition-all text-left ${
                  isCurrent
                    ? 'border-primary bg-primary/5 text-primary'
                    : isCompleted
                      ? 'border-border bg-muted/40 text-foreground'
                      : 'border-border/60 bg-background/50 text-muted-foreground opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  {isCompleted ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <div
                      className={`h-3.5 w-3.5 rounded-full text-[9px] font-black flex items-center justify-center shrink-0 ${
                        isCurrent ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {idx + 1}
                    </div>
                  )}
                  <span className="text-[11px] font-bold truncate">{s}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Content */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-xs">
        {/* ========================================================================= */}
        {/* STEP 0: PROPOSER & CONTACT                                               */}
        {/* ========================================================================= */}
        {step === 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <User className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Proposer (Policyholder) Information</h2>
                <p className="text-xs text-muted-foreground">The legal entity or individual entering into the insurance contract.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="First Name" required>
                <input
                  className={inputCls}
                  placeholder="e.g. Rahul"
                  value={proposer.firstName}
                  onChange={(e) => setProposer({ ...proposer, firstName: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Last Name">
                <input
                  className={inputCls}
                  placeholder="e.g. Sharma"
                  value={proposer.lastName}
                  onChange={(e) => setProposer({ ...proposer, lastName: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Mobile Phone Number" required hint="Used for OTP, communications, and customer matching">
                <input
                  className={inputCls}
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={proposer.phone}
                  onChange={(e) => setProposer({ ...proposer, phone: e.target.value.replace(/\D/g, '') })}
                />
              </FieldLabel>

              <FieldLabel label="Email Address">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="rahul.sharma@example.com"
                  value={proposer.email}
                  onChange={(e) => setProposer({ ...proposer, email: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Date of Birth (Proposer)">
                <input
                  className={inputCls}
                  type="date"
                  value={proposer.dateOfBirth}
                  onChange={(e) => setProposer({ ...proposer, dateOfBirth: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Gender (Proposer)">
                <select
                  className={inputCls}
                  value={proposer.gender}
                  onChange={(e) => setProposer({ ...proposer, gender: e.target.value })}
                >
                  {GENDERS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Permanent Account Number (PAN)" hint="Mandatory for high-value term policies">
                <input
                  className={inputCls}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  value={proposer.panNumber}
                  onChange={(e) => setProposer({ ...proposer, panNumber: e.target.value.toUpperCase() })}
                />
              </FieldLabel>

              <FieldLabel label="Aadhaar Number (12 Digits)">
                <input
                  className={inputCls}
                  placeholder="123456789012"
                  maxLength={12}
                  value={proposer.aadhaarNumber}
                  onChange={(e) => setProposer({ ...proposer, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                />
              </FieldLabel>

              <FieldLabel label="Proposer Occupation">
                <select
                  className={inputCls}
                  value={proposer.occupation}
                  onChange={(e) => setProposer({ ...proposer, occupation: e.target.value })}
                >
                  {OCCUPATIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <FieldLabel label="Annual Income (INR)" hint="Required for financial underwriting and sum assured justification">
                <input
                  className={inputCls}
                  type="number"
                  step="50000"
                  min="0"
                  placeholder="e.g. 1200000"
                  value={proposer.annualIncome !== undefined ? proposer.annualIncome : ''}
                  onChange={(e) =>
                    setProposer({
                      ...proposer,
                      annualIncome: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </FieldLabel>
            </div>

            {/* Address Details */}
            <div className="pt-2 border-t border-border">
              <h3 className="text-xs font-bold text-foreground mb-3">Communication Address</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <FieldLabel label="Street Address">
                    <input
                      className={inputCls}
                      placeholder="Flat, building, street..."
                      value={proposer.addressLine1}
                      onChange={(e) => setProposer({ ...proposer, addressLine1: e.target.value })}
                    />
                  </FieldLabel>
                </div>
                <FieldLabel label="City">
                  <input
                    className={inputCls}
                    placeholder="e.g. Mumbai"
                    value={proposer.city}
                    onChange={(e) => setProposer({ ...proposer, city: e.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="State">
                  <input
                    className={inputCls}
                    placeholder="e.g. Maharashtra"
                    value={proposer.state}
                    onChange={(e) => setProposer({ ...proposer, state: e.target.value })}
                  />
                </FieldLabel>
                <FieldLabel label="Pincode (6 Digits)">
                  <input
                    className={inputCls}
                    maxLength={6}
                    placeholder="400001"
                    value={proposer.pincode}
                    onChange={(e) => setProposer({ ...proposer, pincode: e.target.value.replace(/\D/g, '') })}
                  />
                </FieldLabel>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 1: PLAN CATEGORY & PARAMETERS (SECTION A)                           */}
        {/* ========================================================================= */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Shield className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Select Life Insurance Plan Category</h2>
                <p className="text-xs text-muted-foreground">Select one of the 8 IRDAI Life Insurance categories.</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <FieldLabel label="Proposal Type" required>
                <select className={inputCls} value={policyForm} onChange={(e) => setPolicyForm(e.target.value)}>
                  {POLICY_FORMS.map((pf) => (
                    <option key={pf.value} value={pf.value}>
                      {pf.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>

            {/* Plan Category Cards */}
            <div>
              <label className="block text-[11px] font-bold text-foreground mb-2">
                Insurance Category <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLAN_CATEGORIES.map((cat) => {
                  const isSelected = planCategory === cat.value;
                  return (
                    <button
                      key={cat.value}
                      type="button"
                      onClick={() => handleCategoryChange(cat.value)}
                      className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                          : 'border-border bg-background hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-black text-foreground">{cat.label}</span>
                        {isSelected && <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{cat.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section A Fields */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                  Section A: {labelOf(PLAN_CATEGORIES, planCategory)} Parameters
                </h3>
              </div>

              <LifeFields
                fields={SECTION_A_FIELDS[planCategory] || []}
                values={categoryData}
                onChange={(newVals) => setCategoryData(newVals)}
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 2: LIFE ASSURED & UNDERWRITING                                      */}
        {/* ========================================================================= */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Heart className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Life Assured & Medical Underwriting</h2>
                <p className="text-xs text-muted-foreground">Information describing the person whose life is being covered.</p>
              </div>
            </div>

            {/* Self vs Different Person Toggle */}
            <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground">Is the Life Assured different from the Proposer?</span>
                  <p className="text-[10px] text-muted-foreground">Select Yes if proposing on behalf of a spouse, child, or parent.</p>
                </div>
                <YesNo value={isLifeAssuredDifferent} onChange={(v) => setIsLifeAssuredDifferent(v)} />
              </div>

              {isLifeAssuredDifferent && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-border">
                  <FieldLabel label="Relation to Proposer" required>
                    <select
                      className={inputCls}
                      value={proposerRelation}
                      onChange={(e) => setProposerRelation(e.target.value)}
                    >
                      {PROPOSER_RELATIONS.filter((r) => r.value !== 'SELF').map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>

                  <FieldLabel label="Life Assured Legal Name" required>
                    <input
                      className={inputCls}
                      placeholder="e.g. Sunita Sharma"
                      value={lifeAssuredName}
                      onChange={(e) => setLifeAssuredName(e.target.value)}
                    />
                  </FieldLabel>

                  <FieldLabel label="Life Assured Date of Birth" required>
                    <input
                      className={inputCls}
                      type="date"
                      value={lifeAssuredDob}
                      onChange={(e) => setLifeAssuredDob(e.target.value)}
                    />
                  </FieldLabel>

                  <FieldLabel label="Life Assured Gender" required>
                    <select
                      className={inputCls}
                      value={lifeAssuredGender}
                      onChange={(e) => setLifeAssuredGender(e.target.value)}
                    >
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                </div>
              )}
            </div>

            {/* Medical & Lifestyle Parameters */}
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-foreground">Mortality & Health Parameters</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldLabel label="Tobacco / Smoker Status" required hint="Impacts mortality underwriting tables significantly">
                  <select
                    className={inputCls}
                    value={smokerStatus}
                    onChange={(e) => setSmokerStatus(e.target.value)}
                  >
                    {SMOKER_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </FieldLabel>

                <FieldLabel label="Occupation Risk Classification">
                  <select
                    className={inputCls}
                    value={occupationRiskCategory}
                    onChange={(e) => setOccupationRiskCategory(e.target.value)}
                  >
                    <option value="CLASS_1_STANDARD">Class 1: White Collar / Desk / Office</option>
                    <option value="CLASS_2_MODERATE">Class 2: Supervisors / Light Field Engineering</option>
                    <option value="CLASS_3_HEAVY">Class 3: Industrial / Construction / Drivers</option>
                    <option value="CLASS_4_HAZARDOUS">Class 4: Chemical / Aviation / High Voltage</option>
                  </select>
                </FieldLabel>

                <FieldLabel label="Height (in cm)" required>
                  <input
                    className={inputCls}
                    type="number"
                    min={60}
                    max={250}
                    placeholder="e.g. 175"
                    value={heightCm !== undefined ? heightCm : ''}
                    onChange={(e) => setHeightCm(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </FieldLabel>

                <FieldLabel label="Weight (in kg)" required>
                  <input
                    className={inputCls}
                    type="number"
                    min={20}
                    max={200}
                    placeholder="e.g. 70"
                    value={weightKg !== undefined ? weightKg : ''}
                    onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </FieldLabel>
              </div>

              {/* Live BMI Badge */}
              {calculatedBmi && (
                <div className="p-3 rounded-xl border border-border bg-card flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      Body Mass Index (BMI): <span className="font-mono text-sm">{calculatedBmi}</span>
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                      calculatedBmi >= 18.5 && calculatedBmi <= 24.9
                        ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        : calculatedBmi < 18.5
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : calculatedBmi <= 29.9
                            ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                            : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                    }`}
                  >
                    {calculatedBmi >= 18.5 && calculatedBmi <= 24.9
                      ? 'Normal Range'
                      : calculatedBmi < 18.5
                        ? 'Underweight'
                        : calculatedBmi <= 29.9
                          ? 'Overweight'
                          : 'Obese (Requires Underwriter Review)'}
                  </span>
                </div>
              )}

              {/* Pre-existing Illness Disclosure */}
              <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-foreground">Pre-Existing Illness / Surgical History</span>
                    <p className="text-[10px] text-muted-foreground">Any diabetes, hypertension, cardiac, or oncology diagnosis.</p>
                  </div>
                  <YesNo value={hasPreExistingIllness} onChange={(v) => setHasPreExistingIllness(v)} />
                </div>

                {hasPreExistingIllness && (
                  <div className="pt-2">
                    <FieldLabel label="Medical History Details" required hint="Provide condition name, date of onset, and ongoing medications">
                      <textarea
                        className={`${inputCls} min-h-[70px] resize-none`}
                        placeholder="e.g. Type 2 Diabetes Mellitus diagnosed in 2021, controlled with Metformin 500mg daily. HbA1c: 6.8%."
                        value={medicalHistoryDetails}
                        onChange={(e) => setMedicalHistoryDetails(e.target.value)}
                      />
                    </FieldLabel>
                  </div>
                )}
              </div>
            </div>

            {/* Joint Life Secondary Assured Section (for Joint Life Annuity) */}
            {isJointAnnuity && (
              <div className="p-5 rounded-xl border border-primary/40 bg-primary/5 space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                    Secondary Life Assured (Joint Life Annuity)
                  </h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FieldLabel label="Secondary Full Legal Name" required>
                    <input
                      className={inputCls}
                      placeholder="e.g. Priyadarshini Sharma"
                      value={secondaryLife.fullName}
                      onChange={(e) => setSecondaryLife({ ...secondaryLife, fullName: e.target.value })}
                    />
                  </FieldLabel>

                  <FieldLabel label="Date of Birth" required>
                    <input
                      className={inputCls}
                      type="date"
                      value={secondaryLife.dateOfBirth}
                      onChange={(e) => setSecondaryLife({ ...secondaryLife, dateOfBirth: e.target.value })}
                    />
                  </FieldLabel>

                  <FieldLabel label="Gender" required>
                    <select
                      className={inputCls}
                      value={secondaryLife.gender}
                      onChange={(e) => setSecondaryLife({ ...secondaryLife, gender: e.target.value })}
                    >
                      {GENDERS.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>

                  <FieldLabel label="Relationship to Primary Life" required>
                    <select
                      className={inputCls}
                      value={secondaryLife.relationToPrimary}
                      onChange={(e) => setSecondaryLife({ ...secondaryLife, relationToPrimary: e.target.value })}
                    >
                      {PROPOSER_RELATIONS.filter((r) => r.value !== 'SELF').map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 3: NOMINEE & APPOINTEE                                              */}
        {/* ========================================================================= */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Nominee & Appointee Designation</h2>
                <p className="text-xs text-muted-foreground">
                  Beneficiary entitled to claim insurance proceeds under Section 39 of the Insurance Act.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FieldLabel label="Nominee Full Legal Name" required>
                <input
                  className={inputCls}
                  placeholder="e.g. Anita Sharma"
                  value={nominee.name}
                  onChange={(e) => setNominee({ ...nominee, name: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Nominee Date of Birth" required hint="Under-18 nominees require an adult Appointee">
                <input
                  className={inputCls}
                  type="date"
                  value={nominee.dateOfBirth}
                  onChange={(e) => setNominee({ ...nominee, dateOfBirth: e.target.value })}
                />
              </FieldLabel>

              <FieldLabel label="Nominee Relationship to Life Assured" required>
                <select
                  className={inputCls}
                  value={nominee.relation}
                  onChange={(e) => setNominee({ ...nominee, relation: e.target.value })}
                >
                  {NOMINEE_RELATIONS.map((nr) => (
                    <option key={nr.value} value={nr.value}>
                      {nr.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>

              <div className="flex items-center gap-2 sm:pt-6">
                {nomineeIsMinor ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Minor Nominee (&lt; 18) - Appointee Required
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Major Nominee (Adult)
                  </span>
                )}
              </div>
            </div>

            {/* Appointee Section (Mandatory if Nominee is Minor) */}
            {nomineeIsMinor && (
              <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-4">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300">
                      Mandatory Appointee Required
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Because the nominee is under 18 years old, an adult appointee (&ge; 18) must be appointed to receive policy benefits on their behalf.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <FieldLabel label="Appointee Full Legal Name" required>
                    <input
                      className={inputCls}
                      placeholder="e.g. Ramesh Sharma"
                      value={appointee.name}
                      onChange={(e) => setAppointee({ ...appointee, name: e.target.value })}
                    />
                  </FieldLabel>

                  <FieldLabel label="Appointee Date of Birth" required hint="Must be at least 18 years of age">
                    <input
                      className={inputCls}
                      type="date"
                      value={appointee.dateOfBirth}
                      onChange={(e) => setAppointee({ ...appointee, dateOfBirth: e.target.value })}
                    />
                  </FieldLabel>

                  <FieldLabel label="Appointee Relationship to Minor Nominee" required>
                    <select
                      className={inputCls}
                      value={appointee.relation}
                      onChange={(e) => setAppointee({ ...appointee, relation: e.target.value })}
                    >
                      {APPOINTEE_RELATIONS.map((ar) => (
                        <option key={ar.value} value={ar.value}>
                          {ar.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* STEP 4: REVIEW & SUBMIT                                                  */}
        {/* ========================================================================= */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <h2 className="text-base font-bold text-foreground">Review Proposal Summary</h2>
                <p className="text-xs text-muted-foreground">Verify all captured proposal data before submitting to the CRM engine.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Proposer Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Proposer (Policyholder)</div>
                <div className="text-sm font-bold text-foreground">{proposer.firstName} {proposer.lastName}</div>
                <div className="text-xs text-muted-foreground">{proposer.phone} • {proposer.email || 'No email'}</div>
                <div className="text-xs font-semibold pt-1">
                  PAN: <span className="font-mono">{proposer.panNumber || 'Not provided'}</span>
                </div>
                <div className="text-xs font-semibold">
                  Income: ₹{Number(proposer.annualIncome || 0).toLocaleString('en-IN')} p.a. • {proposer.occupation}
                </div>
              </div>

              {/* Plan Category Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Plan Category</div>
                <div className="text-sm font-bold text-primary">{labelOf(PLAN_CATEGORIES, planCategory)}</div>
                <div className="text-xs text-muted-foreground">{labelOf(POLICY_FORMS, policyForm)}</div>
                <div className="text-xs font-semibold pt-1">
                  {categoryData.sumAssured
                    ? `Sum Assured: ₹${Number(categoryData.sumAssured).toLocaleString('en-IN')}`
                    : categoryData.purchasePrice
                      ? `Purchase Price: ₹${Number(categoryData.purchasePrice).toLocaleString('en-IN')}`
                      : categoryData.annualInvestmentAmount
                        ? `Annual Investment: ₹${Number(categoryData.annualInvestmentAmount).toLocaleString('en-IN')}`
                        : ''}
                </div>
                <div className="text-xs text-muted-foreground">
                  {categoryData.termYears ? `Term: ${categoryData.termYears} yrs` : ''}{' '}
                  {categoryData.pptYears ? `• PPT: ${categoryData.pptYears} yrs` : ''}
                </div>
              </div>

              {/* Life Assured & Underwriting Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Life Assured</div>
                <div className="text-sm font-bold text-foreground">
                  {isLifeAssuredDifferent ? lifeAssuredName : `${proposer.firstName} ${proposer.lastName}`}
                  <span className="text-[10px] font-semibold text-muted-foreground ml-1.5">
                    ({isLifeAssuredDifferent ? proposerRelation : 'Self'})
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Smoker: <span className="font-bold">{smokerStatus === 'SMOKER' ? 'Yes (Smoker)' : 'Non-Smoker'}</span>
                </div>
                <div className="text-xs font-semibold">
                  BMI: {calculatedBmi || 'N/A'} ({heightCm} cm, {weightKg} kg)
                </div>
                {hasPreExistingIllness && (
                  <div className="text-[11px] text-amber-600 font-semibold pt-1">
                    Medical Disclosure: {medicalHistoryDetails}
                  </div>
                )}
              </div>

              {/* Nominee Card */}
              <div className="p-4 rounded-xl border border-border bg-card space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Beneficiary (Nominee)</div>
                <div className="text-sm font-bold text-foreground">{nominee.name}</div>
                <div className="text-xs text-muted-foreground">
                  Relation: {nominee.relation} • DOB: {nominee.dateOfBirth}
                </div>
                {nomineeIsMinor && (
                  <div className="pt-2 border-t border-border mt-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600">Appointee for Minor</span>
                    <div className="text-xs font-bold text-foreground mt-0.5">{appointee.name} ({appointee.relation})</div>
                    <div className="text-[10px] text-muted-foreground">DOB: {appointee.dateOfBirth}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-6 mt-6 border-t border-border">
          {step > 0 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl border border-border text-xs font-bold hover:bg-muted transition flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-95 transition flex items-center gap-2 shadow-xs"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-7 py-2.5 rounded-xl bg-foreground text-background text-xs font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Creating Proposal...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Create Proposal & Open Workspace</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

