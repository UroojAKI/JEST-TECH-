'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, HeartPulse, Loader2, Plus, Trash2 } from 'lucide-react';
import { healthApiError, healthQuotationRepository } from '../../repositories/health-quotation.repository';
import { leadsRepository } from '../../repositories/leads.repository';
import {
  GENDERS,
  NOMINEE_RELATIONS,
  OCCUPATIONS,
  PLAN_CATEGORIES,
  POLICY_FORMS,
  RELATIONS,
  RENEWAL_FIELDS,
  SECTION_A_FIELDS,
  initialValues,
  labelOf,
  missingRequired,
  toPayload,
} from './healthFormConfig';
import { FieldLabel, HealthFields, YesNo, inputCls } from './HealthFields';

const STEPS = ['Proposer & KYC', 'Plan & Details', 'Insured Members', 'Nominee & Policy', 'Review'];

type Member = {
  firstName: string;
  lastName: string;
  relation: string;
  dateOfBirth: string;
  gender: string;
  heightCm: string;
  weightKg: string;
  preExistingDiseases: string;
  isSmoker: boolean;
};

const emptyMember = (relation = 'SELF'): Member => ({
  firstName: '',
  lastName: '',
  relation,
  dateOfBirth: '',
  gender: 'MALE',
  heightCm: '',
  weightKg: '',
  preExistingDiseases: 'None',
  isSmoker: false,
});

const bmi = (m: Member) => {
  const h = Number(m.heightCm) / 100;
  const w = Number(m.weightKg);
  return h > 0 && w > 0 ? Math.round((w / (h * h)) * 10) / 10 : null;
};

export function HealthQuoteWizard({
  contactId: initialContactId,
  leadId,
}: {
  contactId?: string;
  leadId?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedContactId, setResolvedContactId] = useState<string | undefined>(initialContactId);

  // Proposer state (Step 0)
  const [proposer, setProposer] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    gender: 'MALE',
    dateOfBirth: '',
  });
  const [occupation, setOccupation] = useState('');
  const [annualIncome, setAnnualIncome] = useState('');
  const [address, setAddress] = useState({ line1: '', line2: '', city: '', state: '', pincode: '' });

  // Plan state (Step 1)
  const [planCategory, setPlanCategory] = useState('');
  const [policyForm, setPolicyForm] = useState('NEW_POLICY');
  const sectionAFields = useMemo(() => SECTION_A_FIELDS[planCategory] ?? [], [planCategory]);
  const [planValues, setPlanValues] = useState<Record<string, any>>({});

  // Members state (Step 2)
  const [members, setMembers] = useState<Member[]>([emptyMember('SELF')]);

  // Nominee & Previous Policy (Step 3)
  const [nominee, setNominee] = useState({ name: '', relation: '' });
  const [renewalValues, setRenewalValues] = useState<Record<string, any>>(initialValues(RENEWAL_FIELDS));

  const { data: contact, isLoading: isLoadingContact } = useQuery({
    queryKey: ['health-contact', initialContactId],
    queryFn: () => (initialContactId ? healthQuotationRepository.getContact(initialContactId) : null),
    enabled: Boolean(initialContactId),
  });

  const { data: leadContext } = useQuery({
    queryKey: ['health-lead-context', leadId],
    queryFn: () => (leadId ? leadsRepository.getLeadContext(leadId) : null),
    enabled: Boolean(leadId),
  });

  // Prefill from Contact
  useEffect(() => {
    if (contact) {
      setProposer((prev) => ({
        firstName: contact.firstName || prev.firstName,
        lastName: contact.lastName || prev.lastName,
        phone: contact.phone || contact.mobile || prev.phone,
        email: contact.email || prev.email,
        panNumber: contact.panNumber || prev.panNumber,
        aadhaarNumber: contact.aadhaarNumber || prev.aadhaarNumber,
        gender: contact.gender || prev.gender,
        dateOfBirth: contact.dateOfBirth ? String(contact.dateOfBirth).slice(0, 10) : prev.dateOfBirth,
      }));
      setAddress((prev) => ({
        line1: contact.addressLine1 || contact.address || prev.line1,
        line2: contact.addressLine2 || prev.line2,
        city: contact.city || prev.city,
        state: contact.state || prev.state,
        pincode: contact.pincode || prev.pincode,
      }));
      if (contact.occupation && OCCUPATIONS.some((o) => o.value === contact.occupation)) {
        setOccupation(contact.occupation);
      }
      if (contact.id) {
        setResolvedContactId(contact.id);
      }
    }
  }, [contact]);

  // Prefill from Lead Context
  useEffect(() => {
    if (leadContext && !contact) {
      if (leadContext.contactId) {
        setResolvedContactId(leadContext.contactId);
      }
      const [fName, ...lNames] = (leadContext.contact?.fullName || leadContext.title || '').split(' ');
      setProposer((prev) => ({
        ...prev,
        firstName: prev.firstName || leadContext.contact?.firstName || fName || '',
        lastName: prev.lastName || leadContext.contact?.lastName || lNames.join(' ') || '',
        phone: prev.phone || leadContext.contact?.phone || '',
        email: prev.email || leadContext.contact?.email || '',
        panNumber: prev.panNumber || leadContext.contact?.panNumber || '',
      }));
    }
  }, [leadContext, contact]);

  // Auto-sync Primary Member (SELF) with Proposer
  useEffect(() => {
    setMembers((current) => {
      if (current.length > 0 && current[0].relation === 'SELF') {
        const selfMember = current[0];
        const updated = {
          ...selfMember,
          firstName: selfMember.firstName || proposer.firstName,
          lastName: selfMember.lastName || proposer.lastName,
          gender: selfMember.gender || proposer.gender,
          dateOfBirth: selfMember.dateOfBirth || proposer.dateOfBirth,
        };
        if (
          updated.firstName !== selfMember.firstName ||
          updated.lastName !== selfMember.lastName ||
          updated.gender !== selfMember.gender ||
          updated.dateOfBirth !== selfMember.dateOfBirth
        ) {
          return [updated, ...current.slice(1)];
        }
      }
      return current;
    });
  }, [proposer.firstName, proposer.lastName, proposer.gender, proposer.dateOfBirth]);

  const chooseCategory = (value: string) => {
    setPlanCategory(value);
    setPlanValues(initialValues(SECTION_A_FIELDS[value]));
    if (value === 'INDIVIDUAL') setMembers((m) => m.slice(0, 1));
  };

  const stepErrors = (index: number): string[] => {
    const errors: string[] = [];
    if (index === 0) {
      if (!proposer.firstName.trim()) errors.push('First Name');
      const cleanPhone = proposer.phone.replace(/\D/g, '');
      if (!cleanPhone || cleanPhone.length !== 10) errors.push('Valid 10-digit Mobile Number');
      if (!proposer.email.trim()) errors.push('Email ID');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(proposer.email.trim())) errors.push('Valid Email Format');

      if (proposer.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(proposer.panNumber.toUpperCase().trim())) {
        errors.push('PAN (format ABCDE1234F)');
      }
      if (proposer.aadhaarNumber && !/^\d{12}$/.test(proposer.aadhaarNumber.replace(/\D/g, ''))) {
        errors.push('Aadhaar (12 digits)');
      }
      if (!occupation) errors.push('Occupation');
      if (!address.line1 || !address.city || !address.state || !address.pincode) {
        errors.push('Address (Line 1, City, State, Pincode)');
      }
    }
    if (index === 1) {
      if (!planCategory) errors.push('Plan category');
      errors.push(...missingRequired(sectionAFields, planValues));
    }
    if (index === 2) {
      if (planCategory === 'INDIVIDUAL' && members.length !== 1) errors.push('Individual covers exactly one member');
      if (planCategory === 'FAMILY_FLOATER' && members.length < 2) errors.push('Family Floater needs at least two members');
      if (members.filter((m) => m.relation === 'SELF').length > 1) errors.push('Only one member can be SELF');
      members.forEach((m, i) => {
        const missing = (['firstName', 'relation', 'dateOfBirth', 'gender', 'heightCm', 'weightKg', 'preExistingDiseases'] as const).filter(
          (k) => !m[k],
        );
        if (missing.length) errors.push(`Member ${i + 1}: ${missing.join(', ')}`);
        const height = Number(m.heightCm);
        const weight = Number(m.weightKg);
        if (m.heightCm && (height < 30 || height > 250)) {
          errors.push(`Member ${i + 1}: height must be in centimetres (30–250), e.g. 162 for 5 ft 4 in`);
        }
        if (m.weightKg && (weight < 1 || weight > 300)) {
          errors.push(`Member ${i + 1}: weight must be in kilograms (1–300)`);
        }
        if (m.dateOfBirth && new Date(m.dateOfBirth) > new Date()) {
          errors.push(`Member ${i + 1}: date of birth cannot be in the future`);
        }
        if (m.dateOfBirth && m.relation === 'SELF') {
          const adultOn = new Date(m.dateOfBirth);
          adultOn.setFullYear(adultOn.getFullYear() + 18);
          if (adultOn > new Date()) errors.push(`Member ${i + 1} (Self) must be at least 18 years old`);
        }
      });
    }
    if (index === 3) {
      if (!nominee.name || !nominee.relation) errors.push('Nominee name & relationship');
      if (policyForm === 'RENEWAL_PORTABILITY') errors.push(...missingRequired(RENEWAL_FIELDS, renewalValues));
    }
    return errors;
  };

  const next = () => {
    const errors = stepErrors(step);
    if (errors.length) {
      toast.error(`Please complete: ${errors.join(', ')}`);
      return;
    }
    setStep((s) => s + 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      let finalContactId = resolvedContactId;
      if (!finalContactId) {
        finalContactId = await healthQuotationRepository.resolveOrCreateContact({
          firstName: proposer.firstName,
          lastName: proposer.lastName,
          phone: proposer.phone,
          email: proposer.email,
          panNumber: proposer.panNumber,
          aadhaarNumber: proposer.aadhaarNumber,
        });
        setResolvedContactId(finalContactId);
      }

      const proposerKyc = {
        ...(proposer.email ? { email: proposer.email.trim() } : {}),
        ...(proposer.panNumber ? { panNumber: proposer.panNumber.trim().toUpperCase() } : {}),
        ...(proposer.aadhaarNumber ? { aadhaarNumber: proposer.aadhaarNumber.trim() } : {}),
      };

      const created = await healthQuotationRepository.createCase({
        planCategory,
        policyForm,
        contactId: finalContactId,
        ...(leadId ? { leadId } : {}),
        occupation,
        ...(annualIncome ? { annualIncome: Number(annualIncome) } : {}),
        address: { ...address, ...(address.line2 ? {} : { line2: undefined }) },
        nomineeName: nominee.name,
        nomineeRelation: nominee.relation,
        planDetails: toPayload(sectionAFields, planValues),
        ...(policyForm === 'RENEWAL_PORTABILITY' ? { previousPolicySnapshot: toPayload(RENEWAL_FIELDS, renewalValues) } : {}),
        ...(Object.keys(proposerKyc).length ? { proposerKyc } : {}),
        members: members.map((m) => ({
          firstName: m.firstName,
          ...(m.lastName ? { lastName: m.lastName } : {}),
          relation: m.relation,
          dateOfBirth: m.dateOfBirth,
          gender: m.gender,
          heightCm: Number(m.heightCm),
          weightKg: Number(m.weightKg),
          preExistingDiseases: m.preExistingDiseases,
          isSmoker: m.isSmoker,
        })),
      });
      toast.success(`Health proposal ${created.caseCode} created`);
      (created.planDetails?.warnings ?? []).forEach((w: string) => toast.warning(w));
      router.push(`/sales/health-quotations/${created.id}`);
    } catch (err) {
      toast.error(healthApiError(err, 'Failed to create Health proposal'));
    } finally {
      setSubmitting(false);
    }
  };

  const setMember = (i: number, patch: Partial<Member>) =>
    setMembers((list) => list.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <Link
          href="/sales/health-quotations"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Health Proposals
        </Link>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary">
            <HeartPulse className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-foreground">Generate Health Quotation</h1>
            <p className="text-xs text-muted-foreground">
              {isLoadingContact ? (
                'Loading customer details...'
              ) : proposer.firstName || proposer.phone ? (
                `${proposer.firstName} ${proposer.lastName || ''} • ${proposer.phone}`
              ) : (
                'Direct Quoting — Enter customer details to create proposal case'
              )}
            </p>
          </div>
        </div>
      </div>

      <ol className="flex flex-wrap gap-2">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold border ${
              i === step ? 'bg-primary text-primary-foreground border-primary' : i < step ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground'
            }`}
          >
            <span>{i + 1}</span>
            {label}
          </li>
        ))}
      </ol>

      <div className="p-5 rounded-2xl border bg-card space-y-4">
        {step === 0 && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-sm">Proposer Details &amp; KYC</h2>
                <p className="text-[11px] text-muted-foreground">Common customer CRM identity across Health and Motor</p>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Single Customer CRM Profile
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldLabel label="First Name" required>
                <input
                  className={inputCls}
                  placeholder="e.g. Vikram"
                  value={proposer.firstName}
                  onChange={(e) => setProposer({ ...proposer, firstName: e.target.value })}
                />
              </FieldLabel>
              <FieldLabel label="Last Name">
                <input
                  className={inputCls}
                  placeholder="e.g. Patil"
                  value={proposer.lastName}
                  onChange={(e) => setProposer({ ...proposer, lastName: e.target.value })}
                />
              </FieldLabel>
              <FieldLabel label="Mobile Number" required hint="Used to link customer across Motor & Health">
                <input
                  className={`${inputCls} font-mono`}
                  type="tel"
                  maxLength={10}
                  placeholder="e.g. 9876543210"
                  value={proposer.phone}
                  onChange={(e) => setProposer({ ...proposer, phone: e.target.value.replace(/\D/g, '') })}
                />
              </FieldLabel>
              <FieldLabel label="Email ID" required hint="For policy communications">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="e.g. vikram.patil@example.com"
                  value={proposer.email}
                  onChange={(e) => setProposer({ ...proposer, email: e.target.value })}
                />
              </FieldLabel>
              <FieldLabel label="Gender" required>
                <select
                  className={inputCls}
                  value={proposer.gender}
                  onChange={(e) => setProposer({ ...proposer, gender: e.target.value })}
                >
                  {GENDERS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Date of Birth" hint="Proposer must be 18+">
                <input
                  className={inputCls}
                  type="date"
                  value={proposer.dateOfBirth}
                  onChange={(e) => setProposer({ ...proposer, dateOfBirth: e.target.value })}
                />
              </FieldLabel>
              <FieldLabel label="PAN Number" hint="Format ABCDE1234F">
                <input
                  className={`${inputCls} uppercase font-mono`}
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={proposer.panNumber}
                  onChange={(e) => setProposer({ ...proposer, panNumber: e.target.value.toUpperCase() })}
                />
              </FieldLabel>
              <FieldLabel label="Aadhaar Number (Optional)" hint="12 digits">
                <input
                  className={`${inputCls} font-mono`}
                  maxLength={12}
                  placeholder="12 digit Aadhaar"
                  value={proposer.aadhaarNumber}
                  onChange={(e) => setProposer({ ...proposer, aadhaarNumber: e.target.value.replace(/\D/g, '') })}
                />
              </FieldLabel>
              <FieldLabel label="Occupation" required>
                <select className={inputCls} value={occupation} onChange={(e) => setOccupation(e.target.value)}>
                  <option value="">-- Select Occupation --</option>
                  {OCCUPATIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
              <FieldLabel label="Annual Income" hint="Required for high Sum Insured underwriting">
                <input
                  className={inputCls}
                  type="number"
                  min={0}
                  placeholder="e.g. 1200000"
                  value={annualIncome}
                  onChange={(e) => setAnnualIncome(e.target.value)}
                />
              </FieldLabel>
            </div>

            <h3 className="font-bold text-xs pt-2">Communication Address *</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['line1', 'line2', 'city', 'state', 'pincode'] as const).map((k) => (
                <input
                  key={k}
                  className={inputCls}
                  placeholder={
                    { line1: 'Address line 1 *', line2: 'Address line 2', city: 'City *', state: 'State *', pincode: 'Pincode *' }[k]
                  }
                  value={address[k]}
                  onChange={(e) => setAddress({ ...address, [k]: e.target.value })}
                />
              ))}
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 className="font-black text-sm">Plan Category</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PLAN_CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => chooseCategory(c.value)}
                  className={`p-3 rounded-xl border text-left ${planCategory === c.value ? 'border-primary bg-primary/10' : 'bg-card hover:bg-accent'}`}
                >
                  <div className="font-bold text-xs text-foreground">{c.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{c.hint}</div>
                </button>
              ))}
            </div>
            <FieldLabel label="Policy Type" required>
              <select className={inputCls} value={policyForm} onChange={(e) => setPolicyForm(e.target.value)}>
                {POLICY_FORMS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </FieldLabel>
            {planCategory && (
              <>
                <h3 className="font-bold text-xs pt-2">Plan-Specific Details — {labelOf(PLAN_CATEGORIES, planCategory)}</h3>
                <HealthFields fields={sectionAFields} values={planValues} onChange={setPlanValues} />
              </>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-black text-sm">Insured Members</h2>
              {planCategory !== 'INDIVIDUAL' && (
                <button
                  type="button"
                  onClick={() => setMembers((m) => [...m, emptyMember()])}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-bold hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Add member
                </button>
              )}
            </div>
            {members.map((m, i) => (
              <div key={i} className="p-4 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black">Member {i + 1}</span>
                  <div className="flex items-center gap-3">
                    {bmi(m) !== null && <span className="text-[10px] font-bold text-muted-foreground">BMI {bmi(m)}</span>}
                    {members.length > 1 && (
                      <button type="button" onClick={() => setMembers((list) => list.filter((_, idx) => idx !== i))} className="text-rose-500">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <FieldLabel label="First Name" required>
                    <input className={inputCls} value={m.firstName} onChange={(e) => setMember(i, { firstName: e.target.value })} />
                  </FieldLabel>
                  <FieldLabel label="Last Name">
                    <input className={inputCls} value={m.lastName} onChange={(e) => setMember(i, { lastName: e.target.value })} />
                  </FieldLabel>
                  <FieldLabel label="Relationship to Proposer" required>
                    <select className={inputCls} value={m.relation} onChange={(e) => setMember(i, { relation: e.target.value })}>
                      {RELATIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Date of Birth" required>
                    <input className={inputCls} type="date" value={m.dateOfBirth} onChange={(e) => setMember(i, { dateOfBirth: e.target.value })} />
                  </FieldLabel>
                  <FieldLabel label="Gender" required>
                    <select className={inputCls} value={m.gender} onChange={(e) => setMember(i, { gender: e.target.value })}>
                      <option value="">-- Select --</option>
                      {GENDERS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </FieldLabel>
                  <FieldLabel label="Smoker / Tobacco / Alcohol" required>
                    <YesNo value={m.isSmoker} onChange={(v) => setMember(i, { isSmoker: v })} />
                  </FieldLabel>
                  <FieldLabel label="Height (cm)" required hint="In centimetres, e.g. 162 = 5 ft 4 in">
                    <input
                      className={inputCls}
                      type="number"
                      min={30}
                      max={250}
                      placeholder="e.g. 162"
                      value={m.heightCm}
                      onChange={(e) => setMember(i, { heightCm: e.target.value })}
                    />
                  </FieldLabel>
                  <FieldLabel label="Weight (kg)" required hint="In kilograms">
                    <input
                      className={inputCls}
                      type="number"
                      min={1}
                      max={300}
                      placeholder="e.g. 58"
                      value={m.weightKg}
                      onChange={(e) => setMember(i, { weightKg: e.target.value })}
                    />
                  </FieldLabel>
                  <div className="sm:col-span-3">
                    <FieldLabel label="Pre-Existing Disease Declaration" required hint='Full & honest disclosure mandatory (IRDAI). Write "None" if nothing to declare.'>
                      <textarea
                        className={inputCls}
                        rows={2}
                        value={m.preExistingDiseases}
                        onChange={(e) => setMember(i, { preExistingDiseases: e.target.value })}
                      />
                    </FieldLabel>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-black text-sm">Nominee</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldLabel label="Nominee Name" required hint="Mandatory as per Insurance Act, 1938">
                <input className={inputCls} value={nominee.name} onChange={(e) => setNominee({ ...nominee, name: e.target.value })} />
              </FieldLabel>
              <FieldLabel label="Nominee Relationship" required>
                <select className={inputCls} value={nominee.relation} onChange={(e) => setNominee({ ...nominee, relation: e.target.value })}>
                  <option value="">-- Select --</option>
                  {NOMINEE_RELATIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </FieldLabel>
            </div>
            {policyForm === 'RENEWAL_PORTABILITY' && (
              <>
                <h2 className="font-black text-sm pt-2">Renewal / Portability Details</h2>
                <HealthFields fields={RENEWAL_FIELDS} values={renewalValues} onChange={setRenewalValues} />
              </>
            )}
          </>
        )}

        {step === 4 && (
          <div className="space-y-3 text-xs">
            <h2 className="font-black text-sm">Review</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Proposer</dt>
              <dd className="font-bold">{proposer.firstName} {proposer.lastName} ({proposer.phone})</dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-bold">{proposer.email}</dd>
              <dt className="text-muted-foreground">Plan category</dt>
              <dd className="font-bold">{labelOf(PLAN_CATEGORIES, planCategory)}</dd>
              <dt className="text-muted-foreground">Policy type</dt>
              <dd className="font-bold">{labelOf(POLICY_FORMS, policyForm)}</dd>
              <dt className="text-muted-foreground">Insured members</dt>
              <dd className="font-bold">{members.map((m) => `${m.firstName} (${labelOf(RELATIONS, m.relation)})`).join(', ')}</dd>
              <dt className="text-muted-foreground">Nominee</dt>
              <dd className="font-bold">
                {nominee.name} ({labelOf(NOMINEE_RELATIONS, nominee.relation)})
              </dd>
              <dt className="text-muted-foreground">Occupation</dt>
              <dd className="font-bold">{labelOf(OCCUPATIONS, occupation)}</dd>
              <dt className="text-muted-foreground">Lead</dt>
              <dd className="font-bold">{leadId ? 'Linked' : 'Not linked'}</dd>
            </dl>
            <p className="text-muted-foreground">
              After creating the proposal you can add quotes from several insurers, upload each quote, and complete the document checklist.
            </p>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center pt-2">
        <button
          type="button"
          onClick={() => {
            if (step === 0) {
              router.push('/sales/health-quotations');
            } else {
              setStep((s) => s - 1);
            }
          }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl border bg-card hover:bg-muted text-xs font-bold transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{step === 0 ? 'Back to Health Proposals' : 'Back'}</span>
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" onClick={next} className="flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold">
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={submit}
            className="flex items-center gap-1 px-5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-60"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Create Health Proposal
          </button>
        )}
      </div>
    </div>
  );
}
