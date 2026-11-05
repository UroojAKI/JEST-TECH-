/**
 * Field definitions and metadata for Life Insurance CRM forms.
 * Drives "Section A - Plan-Specific Details", underwriting parameters,
 * riders, and category options across all 8 IRDAI Life Plan Categories.
 */

export type Option = { value: string; label: string; hint?: string };

export const isMaskedPii = (value?: string | null) => Boolean(value && /X{2,}/i.test(value));

export type FieldType = 'text' | 'number' | 'select' | 'multiselect' | 'boolean' | 'date';

export interface FieldSpec {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: Option[];
  hint?: string;
  defaultValue?: any;
  showIf?: (values: Record<string, any>) => boolean;
}

export const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export function labelOf(options: Option[] | { value: string; label: string }[], value?: string | null): string {
  if (!value) return '-';
  const found = options.find((o) => o.value === value);
  return found ? found.label : value;
}

export const PLAN_CATEGORIES: Option[] = [
  { value: 'TERM_LIFE', label: 'Term Life Insurance', hint: 'Pure risk death benefit protection for specified term' },
  { value: 'TERM_WITH_ROP', label: 'Term with Return of Premium (TROP)', hint: 'Pure risk cover + 100% refund of premium on survival' },
  { value: 'ULIP', label: 'Unit Linked Insurance Plan (ULIP)', hint: 'Market-linked fund allocation with death benefit cover' },
  { value: 'ENDOWMENT', label: 'Endowment Plan', hint: 'Guaranteed additions & maturity payout with death protection' },
  { value: 'MONEY_BACK', label: 'Money Back Plan', hint: 'Periodic survival payouts throughout the policy tenure' },
  { value: 'WHOLE_LIFE', label: 'Whole Life Insurance', hint: 'Comprehensive lifelong death benefit up to age 99 / 100' },
  { value: 'CHILD_PLAN', label: 'Child Insurance Plan', hint: 'Targeted education / marriage milestones with Waiver of Premium' },
  { value: 'ANNUITY_PENSION', label: 'Annuity / Pension Plan', hint: 'Guaranteed retirement income (Immediate / Deferred / Joint Life)' },
];

export const POLICY_FORMS: Option[] = opts(
  ['NEW_POLICY', 'New Business Proposal'],
  ['RENEWAL_PORTABILITY', 'Policy Renewal / Portability'],
);

export const POLICY_TYPES: Option[] = opts(
  ['INDIVIDUAL_PURE_RISK', 'Individual Policy'],
  ['JOINT_LIFE', 'Joint Life Policy'],
  ['GROUP_LIFE', 'Group Master Policy'],
);

export const PREMIUM_PAYMENT_TYPES: Option[] = opts(
  ['REGULAR_PAY', 'Regular Pay (Pay throughout term)'],
  ['LIMITED_PAY', 'Limited Pay (5 / 7 / 10 / 12 Years)'],
  ['SINGLE_PAY', 'Single One-Time Premium'],
);

export const PREMIUM_FREQUENCIES: Option[] = opts(
  ['ANNUAL', 'Annual (Yearly)'],
  ['SEMI_ANNUAL', 'Half-Yearly'],
  ['QUARTERLY', 'Quarterly'],
  ['MONTHLY', 'Monthly (NACH / e-Mandate)'],
);

export const OCCUPATIONS: Option[] = opts(
  ['SALARIED', 'Salaried Employee (MNC / Corporate / Govt)'],
  ['SELF_EMPLOYED_PROFESSIONAL', 'Self-Employed Professional (Doctor / CA / Lawyer / Tech)'],
  ['BUSINESS_OWNER', 'Business Owner / Trader / Proprietor'],
  ['AGRICULTURE', 'Agriculture / Primary Producer'],
  ['STUDENT', 'Student'],
  ['HOMEMAKER', 'Homemaker'],
  ['RETIRED', 'Retired Pensioner'],
);

export const SMOKER_STATUSES: Option[] = opts(
  ['NON_SMOKER', 'Non-Smoker (Standard Rates)'],
  ['SMOKER', 'Smoker (Tobacco / Cigarettes / Vaping)'],
  ['UNKNOWN', 'Undisclosed / Under Review'],
);

export const GENDERS: Option[] = opts(
  ['MALE', 'Male'],
  ['FEMALE', 'Female'],
  ['OTHER', 'Other'],
);

export const PROPOSER_RELATIONS: Option[] = opts(
  ['SELF', 'Self (Proposer is Life Assured)'],
  ['SPOUSE', 'Spouse'],
  ['CHILD', 'Child (Son / Daughter)'],
  ['PARENT', 'Parent (Mother / Father)'],
  ['SIBLING', 'Sibling (Brother / Sister)'],
  ['OTHER', 'Other Legal Relationship'],
);

export const NOMINEE_RELATIONS: Option[] = opts(
  ['SPOUSE', 'Spouse'],
  ['CHILD', 'Child (Son / Daughter)'],
  ['PARENT', 'Parent (Mother / Father)'],
  ['SIBLING', 'Sibling (Brother / Sister)'],
  ['OTHER', 'Other Nominee Relation'],
);

export const APPOINTEE_RELATIONS: Option[] = opts(
  ['PARENT', 'Parent (Mother / Father)'],
  ['SPOUSE', 'Spouse'],
  ['GRANDPARENT', 'Grandparent'],
  ['UNCLE_AUNT', 'Uncle / Aunt'],
  ['LEGAL_GUARDIAN', 'Court-Appointed Legal Guardian'],
  ['OTHER', 'Other Adult Appointee'],
);

export const ANNUITY_OPTIONS: Option[] = opts(
  ['LIFE_ANNUITY_SINGLE', 'Life Annuity (Single Life - No ROP)'],
  ['LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE', 'Life Annuity with Return of Purchase Price (ROP)'],
  ['JOINT_LIFE_LAST_SURVIVOR', 'Joint Life Annuity (Last Survivor - 100% to secondary)'],
  ['JOINT_LIFE_WITH_RETURN_OF_PURCHASE_PRICE', 'Joint Life Annuity with Return of Purchase Price (ROP)'],
  ['GUARANTEED_PERIOD_5_YEARS', 'Annuity Guaranteed for 5 Years & Life Thereafter'],
  ['GUARANTEED_PERIOD_10_YEARS', 'Annuity Guaranteed for 10 Years & Life Thereafter'],
  ['INCREASING_ANNUITY_3_PERCENT', 'Increasing Annuity (3% compounding p.a.)'],
);

export const STANDARD_RIDERS: Option[] = opts(
  ['CRITICAL_ILLNESS', 'Comprehensive Critical Illness Benefit'],
  ['ACCIDENTAL_DEATH_BENEFIT', 'Accidental Death Benefit (ADB)'],
  ['ACCIDENTAL_DISABILITY_BENEFIT', 'Accidental Total & Permanent Disability (ATPD)'],
  ['WAIVER_OF_PREMIUM', 'Waiver of Premium on Critical Illness / Disability'],
  ['TERMINAL_ILLNESS_RIDER', 'Accelerated Terminal Illness Benefit'],
  ['HOSPITAL_CASH_RIDER', 'Daily Hospital Cash Allowance'],
);

export const DEATH_BENEFIT_PAYOUTS: Option[] = opts(
  ['LUMP_SUM', '100% Lump Sum Payout'],
  ['MONTHLY_INCOME', 'Monthly Income over 10 Years'],
  ['LUMP_SUM_PLUS_INCOME', '50% Lump Sum + 50% Monthly Income'],
  ['INCREASING_INCOME', 'Increasing Monthly Income (10% p.a.)'],
);

export const ULIP_FUNDS: Option[] = opts(
  ['GROWTH_EQUITY', 'Pure Equity Large & Mid-Cap Growth Fund'],
  ['BALANCED', 'Balanced / Dynamic Asset Allocation Fund (50:50)'],
  ['DEBT_SECURE', 'Gilt & Corporate Debt Secure Income Fund'],
  ['LIQUID_CASH', 'Money Market / Liquid Treasury Fund'],
);

export const RISK_PROFILES: Option[] = opts(
  ['CONSERVATIVE', 'Conservative (Capital Preservation Focus)'],
  ['MODERATE', 'Moderate (Balanced Risk-Return)'],
  ['AGGRESSIVE', 'Aggressive (High Growth / Equity Biased)'],
);

/**
 * Checks if selected annuity option involves a secondary joint life assured.
 */
export function isJointLifeAnnuity(option?: string | null): boolean {
  return Boolean(option && option.startsWith('JOINT_LIFE'));
}

/**
 * Computes BMI from height (cm) and weight (kg).
 */
export function calculateBmi(weightKg?: number | null, heightCm?: number | null): number | null {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) return null;
  const meters = heightCm / 100;
  return Number((weightKg / (meters * meters)).toFixed(1));
}

/**
 * Determines whether a given date of birth corresponds to a minor (< 18 years old).
 */
export function isMinor(dobString?: string | null): boolean {
  if (!dobString) return false;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return false;
  const diffMs = Date.now() - dob.getTime();
  const ageYears = diffMs / (365.25 * 24 * 60 * 60 * 1000);
  return ageYears < 18;
}

// ---------------------------------------------------------------------------------
// Section A Field Specifications per Plan Category
// ---------------------------------------------------------------------------------

export const SECTION_A_FIELDS: Record<string, FieldSpec[]> = {
  TERM_LIFE: [
    { key: 'sumAssured', label: 'Sum Assured (Death Benefit)', type: 'number', required: true, hint: 'Minimum ₹10,00,000' },
    { key: 'termYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Duration of coverage (5 to 50 years)' },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'Years to pay premium (1 to term years)' },
    { key: 'deathBenefitPayoutOption', label: 'Death Benefit Settlement Option', type: 'select', required: true, options: DEATH_BENEFIT_PAYOUTS, defaultValue: 'LUMP_SUM' },
    { key: 'terminalIllnessBenefitIncluded', label: 'Terminal Illness Acceleration Included', type: 'boolean', required: false, defaultValue: true },
  ],

  TERM_WITH_ROP: [
    { key: 'sumAssured', label: 'Sum Assured (Death Benefit)', type: 'number', required: true, hint: 'Minimum ₹5,00,000' },
    { key: 'termYears', label: 'Policy Term (Years)', type: 'number', required: true },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true },
    { key: 'deathBenefitPayoutOption', label: 'Death Benefit Settlement Option', type: 'select', required: true, options: DEATH_BENEFIT_PAYOUTS, defaultValue: 'LUMP_SUM' },
    { key: 'ropPercentage', label: 'Return of Premium % on Maturity', type: 'number', required: true, defaultValue: 100, hint: 'Typically 100% of basic premiums paid' },
  ],

  ULIP: [
    { key: 'annualInvestmentAmount', label: 'Target Annual Investment Premium', type: 'number', required: true, hint: 'Minimum ₹12,000 p.a.' },
    { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Typically 10, 15, or 20 years' },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'Typically 5, 7, 10 years or equal to term' },
    { key: 'fundChoice', label: 'Initial Fund Allocation Choice', type: 'select', required: true, options: ULIP_FUNDS, defaultValue: 'BALANCED' },
    { key: 'riskProfile', label: 'Investor Risk Tolerance Profile', type: 'select', required: true, options: RISK_PROFILES, defaultValue: 'MODERATE' },
    { key: 'topUpAllowed', label: 'Enable Top-up Premium Facility', type: 'boolean', required: false, defaultValue: false },
  ],

  ENDOWMENT: [
    { key: 'sumAssured', label: 'Guaranteed Maturity Sum Assured', type: 'number', required: true, hint: 'Minimum ₹50,000' },
    { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true },
    { key: 'guaranteedAdditionPercent', label: 'Guaranteed Addition / Simple Reversionary Bonus (%)', type: 'number', required: false, hint: 'e.g. 5.5% p.a.' },
    { key: 'maturityPayoutOption', label: 'Maturity Payout Choice', type: 'select', required: true, options: opts(['LUMP_SUM', 'Lump Sum at Maturity'], ['REGULAR_ANNUAL_INCOME', 'Annual Structured Payout']), defaultValue: 'LUMP_SUM' },
  ],

  MONEY_BACK: [
    { key: 'sumAssured', label: 'Base Sum Assured', type: 'number', required: true },
    { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Common terms: 15, 20, 25 years' },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true },
    { key: 'survivalBenefitIntervalYears', label: 'Survival Benefit Payout Interval (Every N Years)', type: 'number', required: true, defaultValue: 5, hint: 'e.g. Every 5th year 20% of Sum Assured' },
    { key: 'guaranteedAdditionPercent', label: 'Guaranteed Addition (%)', type: 'number', required: false },
  ],

  WHOLE_LIFE: [
    { key: 'sumAssured', label: 'Sum Assured', type: 'number', required: true, hint: 'Minimum ₹5,00,000' },
    { key: 'coverageUptoAge', label: 'Coverage Duration Limit (Age)', type: 'number', required: true, defaultValue: 99, hint: '99 or 100 years of age' },
    { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'e.g. 10, 15, or up to age 60' },
    { key: 'survivalBenefitStartAge', label: 'Survival Income Benefit Start Age', type: 'number', required: false, defaultValue: 60 },
  ],

  CHILD_PLAN: [
    { key: 'childName', label: 'Child Full Legal Name', type: 'text', required: true },
    { key: 'childDob', label: 'Child Date of Birth', type: 'date', required: true },
    { key: 'childGender', label: 'Child Gender', type: 'select', required: true, options: GENDERS, defaultValue: 'MALE' },
    { key: 'targetCorpus', label: 'Target Education / Marriage Corpus', type: 'number', required: true, hint: 'Projected financial goal in INR' },
    { key: 'waiverOfPremiumOnParentDeath', label: 'Waiver of Premium (WOP) on Proposer Death', type: 'boolean', required: true, defaultValue: true, hint: 'Ensures future premiums are paid by insurer if parent passes away' },
  ],

  ANNUITY_PENSION: [
    { key: 'purchasePrice', label: 'Purchase Price / Investment Corpus', type: 'number', required: true, hint: 'Minimum ₹1,00,000 single lump-sum' },
    { key: 'annuityOption', label: 'Annuity Annuity Structure Option', type: 'select', required: true, options: ANNUITY_OPTIONS, defaultValue: 'LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE' },
    { key: 'payoutFrequency', label: 'Pension Annuity Payout Frequency', type: 'select', required: true, options: PREMIUM_FREQUENCIES, defaultValue: 'MONTHLY' },
    { key: 'defermentPeriodYears', label: 'Deferment Period (Years - 0 for Immediate Annuity)', type: 'number', required: false, defaultValue: 0 },
  ],
};

