/**
 * Field definitions for the Health Insurance CRM forms (Health_Insurance_CRM_Forms).
 * One config drives the "Section A - Plan-Specific Details" form for all 8 categories.
 * Keys and option values match the API DTOs in apps/api/src/modules/health-insurance/dto.
 */

export type Option = { value: string; label: string };

export type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: Option[];
  hint?: string;
  defaultValue?: any;
  /** Only shown (and sent) when this returns true */
  showIf?: (values: Record<string, any>) => boolean;
}

const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export const PLAN_CATEGORIES = [
  { value: 'INDIVIDUAL', label: 'Individual Health', hint: 'Single insured member (indemnity / fixed benefit)' },
  { value: 'FAMILY_FLOATER', label: 'Family Floater', hint: 'One sum insured shared by the family' },
  { value: 'SENIOR_CITIZEN', label: 'Senior Citizen', hint: 'Typically 60+ with co-payment' },
  { value: 'CRITICAL_ILLNESS', label: 'Critical Illness / Cancer', hint: 'Lump sum on first diagnosis' },
  { value: 'TOP_UP', label: 'Top-up / Super Top-up', hint: 'Above a deductible' },
  { value: 'GROUP_CORPORATE', label: 'Group / Corporate', hint: 'Employer, affinity or association' },
  { value: 'PERSONAL_ACCIDENT', label: 'Personal Accident', hint: 'Death & disability benefits' },
  { value: 'MISCELLANEOUS', label: 'Miscellaneous', hint: 'Maternity, OPD, Travel, Micro' },
];

export const POLICY_FORMS = opts(
  ['NEW_POLICY', 'New Policy'],
  ['RENEWAL_PORTABILITY', 'Renewal / Portability (Port-in)'],
);

export const RELATIONS = opts(['SELF', 'Self'], ['SPOUSE', 'Spouse'], ['CHILD', 'Child'], ['PARENT', 'Parent'], ['OTHER', 'Other']);
export const NOMINEE_RELATIONS = opts(['SPOUSE', 'Spouse'], ['CHILD', 'Child'], ['PARENT', 'Parent'], ['SIBLING', 'Sibling'], ['OTHER', 'Other']);
export const GENDERS = opts(['MALE', 'Male'], ['FEMALE', 'Female'], ['OTHER', 'Other']);
export const OCCUPATIONS = opts(
  ['SALARIED', 'Salaried'],
  ['SELF_EMPLOYED', 'Self-employed'],
  ['BUSINESS', 'Business'],
  ['PROFESSIONAL', 'Professional'],
  ['HOMEMAKER', 'Homemaker'],
  ['STUDENT', 'Student'],
  ['RETIRED', 'Retired'],
);

export const RIDERS = opts(
  ['CRITICAL_ILLNESS', 'Critical Illness'],
  ['PERSONAL_ACCIDENT', 'Personal Accident'],
  ['HOSPITAL_CASH', 'Hospital Cash'],
  ['OPD_COVER', 'OPD Cover'],
  ['MATERNITY_COVER', 'Maternity Cover'],
  ['ROOM_RENT_WAIVER', 'Room Rent Waiver'],
);

export const WAITING_PERIODS = opts(
  ['INITIAL_30_DAYS', 'Initial 30 days'],
  ['PED_2_4_YEARS', 'PED 2–4 years'],
  ['SPECIFIC_ILLNESS_1_2_YEARS', 'Specific illness 1–2 years'],
);

export const TENURES = opts(['1', '1 Year'], ['2', '2 Years'], ['3', '3 Years']);

const ROOM_RENT = opts(['SINGLE_PRIVATE_AC', 'Single Private AC'], ['TWIN_SHARING', 'Twin Sharing'], ['NO_CAPPING', 'No Capping']);

const planName: FieldSpec = { key: 'planName', label: 'Plan Name', type: 'text', required: true, hint: 'As filed with IRDAI' };
const uin: FieldSpec = { key: 'uin', label: 'UIN', type: 'text', required: true, hint: 'Unique Identification Number (IRDAI)' };
const sumInsured = (label = 'Sum Insured'): FieldSpec => ({ key: 'sumInsured', label, type: 'number', required: true });
const roomRent: FieldSpec = { key: 'roomRentCategory', label: 'Room Rent Category', type: 'select', required: true, options: ROOM_RENT };

export const SECTION_A_FIELDS: Record<string, FieldSpec[]> = {
  INDIVIDUAL: [
    planName,
    uin,
    sumInsured('Sum Insured Option'),
    { key: 'indemnityType', label: 'Plan Type (Indemnity / Fixed Benefit)', type: 'select', required: true, options: opts(['INDEMNITY', 'Indemnity'], ['FIXED_BENEFIT', 'Fixed Benefit']) },
    roomRent,
    { key: 'existingHealthPolicy', label: 'Existing Health Policy', type: 'boolean', required: false, hint: 'Disclosure of concurrent covers' },
  ],
  FAMILY_FLOATER: [
    planName,
    uin,
    sumInsured('Sum Insured (Floater)'),
    roomRent,
    { key: 'maternityCoverRequired', label: 'Maternity Cover Required', type: 'boolean', required: false, hint: 'Subject to plan availability & waiting period' },
  ],
  SENIOR_CITIZEN: [
    planName,
    uin,
    sumInsured(),
    { key: 'coPaymentPercent', label: 'Co-payment Applicable (%)', type: 'number', required: true, hint: 'Common for senior citizen plans (10–20%)' },
    {
      key: 'prePolicyMedicalTests',
      label: 'Pre-Policy Medical Tests',
      type: 'multiselect',
      required: true,
      options: opts(['ECG', 'ECG'], ['BLOOD_SUGAR', 'Blood Sugar'], ['LIPID_PROFILE', 'Lipid Profile'], ['RENAL_FUNCTION', 'Renal Function']),
    },
    {
      key: 'existingChronicIllness',
      label: 'Existing Chronic Illness',
      type: 'multiselect',
      required: true,
      options: opts(['NONE', 'None'], ['DIABETES', 'Diabetes'], ['HYPERTENSION', 'Hypertension'], ['CARDIAC', 'Cardiac'], ['OTHER', 'Other']),
    },
  ],
  CRITICAL_ILLNESS: [
    planName,
    uin,
    sumInsured('Sum Insured (Lump Sum Benefit)'),
    {
      key: 'illnessesCovered',
      label: 'Illnesses Covered',
      type: 'multiselect',
      required: true,
      options: opts(
        ['CANCER', 'Cancer'],
        ['HEART_ATTACK', 'Heart Attack'],
        ['STROKE', 'Stroke'],
        ['KIDNEY_FAILURE', 'Kidney Failure'],
        ['MAJOR_ORGAN_TRANSPLANT', 'Major Organ Transplant'],
        ['OTHER', 'Other'],
      ),
    },
    { key: 'survivalPeriodDays', label: 'Survival Period Clause (days)', type: 'number', required: true, defaultValue: 30, hint: 'Typically 30 days post-diagnosis' },
    { key: 'familyHistoryOfCriticalIllness', label: 'Family History of Critical Illness', type: 'boolean', required: true },
  ],
  TOP_UP: [
    planName,
    uin,
    sumInsured(),
    { key: 'deductibleAmount', label: 'Deductible / Threshold Limit', type: 'number', required: true },
    { key: 'basePolicySumInsured', label: 'Base Policy Sum Insured (Existing)', type: 'number', required: true, hint: 'To confirm deductible eligibility' },
    {
      key: 'deductibleBasis',
      label: 'Deductible Basis',
      type: 'select',
      required: true,
      options: opts(['PER_CLAIM', 'Per Claim (Top-up)'], ['AGGREGATE_ANNUAL', 'Aggregate Annual (Super Top-up)']),
    },
    { key: 'existingBaseInsurerName', label: 'Existing Base Insurer Name', type: 'text', required: false },
  ],
  GROUP_CORPORATE: [
    {
      key: 'schemeType',
      label: 'Scheme / Master Policy Type',
      type: 'select',
      required: true,
      options: opts(['EMPLOYER_EMPLOYEE', 'Employer-Employee'], ['AFFINITY_GROUP', 'Affinity Group'], ['ASSOCIATION', 'Association']),
    },
    { key: 'memberStrength', label: 'Employee / Member Strength', type: 'number', required: true },
    { key: 'sumInsuredBasis', label: 'Sum Insured Basis', type: 'select', required: true, options: opts(['FLAT', 'Flat'], ['GRADED', 'Graded by employee category']) },
    sumInsured(),
    {
      key: 'gradeWiseSumInsured',
      label: 'Grade-wise Sum Insured',
      type: 'text',
      required: true,
      hint: 'e.g. Manager:500000, Staff:300000',
      showIf: (v) => v.sumInsuredBasis === 'GRADED',
    },
    { key: 'parentalCoverIncluded', label: 'Parental Cover Included', type: 'boolean', required: false },
    { key: 'masterPolicyholderName', label: 'Master Policyholder Name', type: 'text', required: true, hint: 'Employer / Association name' },
    { key: 'policyEffectiveDate', label: 'Policy Effective Date (Scheme)', type: 'date', required: true },
  ],
  PERSONAL_ACCIDENT: [
    planName,
    uin,
    sumInsured('Sum Insured (Capital Benefit)'),
    {
      key: 'coverType',
      label: 'Cover Type',
      type: 'select',
      required: true,
      options: opts(['INDIVIDUAL', 'Individual'], ['FAMILY_FLOATER', 'Family Floater'], ['GROUP', 'Group']),
    },
    {
      key: 'occupationRiskCategory',
      label: 'Occupation Risk Category',
      type: 'select',
      required: true,
      options: opts(['CATEGORY_I', 'Category I'], ['CATEGORY_II', 'Category II'], ['CATEGORY_III', 'Category III'], ['HAZARDOUS', 'Hazardous']),
    },
    { key: 'permanentTotalDisabilityPercent', label: 'Permanent Total Disability Benefit (%)', type: 'number', required: true, defaultValue: 100 },
    { key: 'temporaryTotalDisabilityWeeklyBenefit', label: 'Temporary Total Disability Weekly Benefit', type: 'number', required: false },
  ],
  MISCELLANEOUS: [
    {
      key: 'planType',
      label: 'Plan Type',
      type: 'select',
      required: true,
      options: opts(['MATERNITY_ADDON', 'Maternity Add-on'], ['OPD_COVER', 'OPD Cover'], ['TRAVEL_HEALTH', 'Travel Health'], ['MICRO_INSURANCE', 'Micro-Insurance']),
    },
    sumInsured(),
    {
      key: 'maternityWaitingPeriod',
      label: 'Waiting Period (Maternity)',
      type: 'text',
      required: true,
      hint: 'Typically 9 months to 4 years',
      showIf: (v) => v.planType === 'MATERNITY_ADDON',
    },
    { key: 'travelDestination', label: 'Travel Destination', type: 'text', required: true, showIf: (v) => v.planType === 'TRAVEL_HEALTH' },
    { key: 'travelDurationDays', label: 'Travel Duration (days)', type: 'number', required: true, showIf: (v) => v.planType === 'TRAVEL_HEALTH' },
    {
      key: 'coverageTerritory',
      label: 'Coverage Territory',
      type: 'select',
      required: true,
      options: opts(['INDIA', 'India'], ['WORLDWIDE_EXCL_US_CANADA', 'Worldwide excl. US-Canada'], ['WORLDWIDE_INCL_US_CANADA', 'Worldwide incl. US-Canada']),
      showIf: (v) => v.planType === 'TRAVEL_HEALTH',
    },
  ],
};

/** Policy Form (ii) - Renewal / Portability fields. */
export const RENEWAL_FIELDS: FieldSpec[] = [
  { key: 'renewalType', label: 'Renewal or Port-in', type: 'select', required: true, options: opts(['RENEWAL', 'Renewal'], ['PORTABILITY', 'Portability (Port-in)']) },
  { key: 'previousInsurerName', label: 'Previous Insurer Name', type: 'text', required: true },
  { key: 'previousPolicyNumber', label: 'Previous Policy Number', type: 'text', required: true },
  { key: 'sumInsuredContinuation', label: 'Sum Insured', type: 'select', required: true, options: opts(['CONTINUED', 'Continued'], ['ENHANCED', 'Enhanced']) },
  { key: 'cumulativeBonusPercent', label: 'Cumulative Bonus / No Claim Bonus (%)', type: 'number', required: true, hint: "Accrued as per expiring policy's terms" },
  { key: 'claimInExpiringPolicy', label: 'Claim in Expiring Policy', type: 'boolean', required: true, hint: 'If yes, cumulative bonus resets / reduces' },
  {
    key: 'waitingPeriodCredit',
    label: 'Waiting Period Credit',
    type: 'boolean',
    required: true,
    hint: 'As per IRDAI portability guidelines',
    showIf: (v) => v.renewalType === 'PORTABILITY',
  },
  { key: 'previousPolicyExpiryDate', label: 'Previous Policy Expiry Date', type: 'date', required: false },
];

/** Initial values: defaults, and `false` for booleans so they are always sent. */
export function initialValues(fields: FieldSpec[]): Record<string, any> {
  return Object.fromEntries(
    fields.map((f) => [f.key, f.defaultValue ?? (f.type === 'boolean' ? false : f.type === 'multiselect' ? [] : '')]),
  );
}

/** Converts form values to the API shape: numbers, dropped hidden/empty optional fields. */
export function toPayload(fields: FieldSpec[], values: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of fields) {
    if (f.showIf && !f.showIf(values)) continue;
    const v = values[f.key];
    if (v === '' || v === undefined || v === null) continue;
    if (f.type === 'number') out[f.key] = Number(v);
    else if (f.key === 'gradeWiseSumInsured' && typeof v === 'string') {
      out[f.key] = Object.fromEntries(
        v
          .split(',')
          .map((pair) => pair.split(':').map((s) => s.trim()))
          .filter(([grade, amount]) => grade && amount)
          .map(([grade, amount]) => [grade, Number(amount)]),
      );
    } else out[f.key] = v;
  }
  return out;
}

/** Fields that are required, visible and still empty. */
export function missingRequired(fields: FieldSpec[], values: Record<string, any>): string[] {
  return fields
    .filter((f) => f.required && f.type !== 'boolean' && (!f.showIf || f.showIf(values)))
    .filter((f) => {
      const v = values[f.key];
      return v === '' || v === undefined || v === null || (Array.isArray(v) && v.length === 0);
    })
    .map((f) => f.label);
}

/** Mirrors the API premium maths for a live preview (API remains the source of truth). */
export function previewPremium(basePremium: number, riderPremiums: number[], commissionPercent: number) {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const rider = round2(riderPremiums.reduce((s, p) => s + (p || 0), 0));
  const net = round2((basePremium || 0) + rider);
  const gst = round2(net * 0.18);
  const total = round2(net + gst);
  const commission = round2((net * (commissionPercent || 0)) / 100);
  return { rider, net, gst, total, commission, netPayable: round2(total - commission) };
}

export const inr = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? '—' : `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const labelOf = (options: Option[], value: string) => options.find((o) => o.value === value)?.label ?? value;
