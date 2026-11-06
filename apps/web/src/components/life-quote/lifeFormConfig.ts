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
  placeholder?: string;
  defaultValue?: any;
  showIf?: (values: Record<string, any>) => boolean;
}

export const opts = (...pairs: [string, string][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

export function labelOf(options: Option[] | { value: string; label: string }[], value?: string | null): string {
  if (!value) return '-';
  const found = options.find((o) => o.value === value);
  return found ? found.label : value;
}

export const CATEGORY_TO_PRISMA_MAP: Record<string, string> = {
  TERM_LIFE: 'TERM_INSURANCE',
  TERM_WITH_ROP: 'TERM_INSURANCE',
  ULIP: 'INVESTMENT_PLANS',
  ENDOWMENT: 'SAVINGS_PLANS',
  MONEY_BACK: 'SAVINGS_PLANS',
  WHOLE_LIFE: 'WHOLE_LIFE',
  CHILD_PLAN: 'CHILD_FUTURE',
  ANNUITY_PENSION: 'ANNUITY',
  TERM_INSURANCE: 'TERM_INSURANCE',
  SAVINGS_PLANS: 'SAVINGS_PLANS',
  INVESTMENT_PLANS: 'INVESTMENT_PLANS',
  RETIREMENT_PENSION: 'RETIREMENT_PENSION',
  CHILD_FUTURE: 'CHILD_FUTURE',
  ANNUITY: 'ANNUITY',
  GROUP_INSURANCE: 'GROUP_INSURANCE',
};

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
  ['RENEWAL', 'Policy Renewal / Portability'],
  ['RIDERS_ADDON', 'Riders / Add-on Endorsement'],
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
  ['SELF_EMPLOYED', 'Self-Employed (Doctor / CA / Lawyer / Consultant)'],
  ['BUSINESS', 'Business Owner / Trader / Entrepreneur'],
  ['PROFESSIONAL', 'Corporate Professional'],
  ['STUDENT', 'Student'],
  ['HOMEMAKER', 'Homemaker'],
  ['RETIRED', 'Retired Pensioner'],
);

export const LEAD_SOURCES: Option[] = opts(
  ['WALK_IN', 'Walk-in Customer'],
  ['REFERRAL', 'Client / Associate Referral'],
  ['ADVISOR', 'Advisor / Direct Agent'],
  ['DIGITAL', 'Digital / Web Portal'],
  ['RENEWAL', 'Renewal Portability'],
  ['CROSS_SELL', 'Cross-sell (Motor / Health Client)'],
);

export const MEDICAL_TEST_REQUIREMENTS: Option[] = opts(
  ['NON_MEDICAL', 'Non-Medical (Standard Underwriting)'],
  ['TELE_MER', 'Tele-Medical Examination (Tele-MER)'],
  ['PHYSICAL_MEDICAL', 'Full Physical Medical & Pathology Tests'],
);

export const PLAN_VARIANTS: Option[] = opts(
  ['WITH_PROFIT', 'With-Profit (Participating / Bonus Earning)'],
  ['NON_PAR_GUARANTEED', 'Non-Participating (Guaranteed Returns)'],
);

export const BONUS_TYPES: Option[] = opts(
  ['SIMPLE_REVERSIONARY', 'Simple Reversionary Bonus'],
  ['COMPOUND_REVERSIONARY', 'Compound Reversionary Bonus'],
  ['CASH_BONUS', 'Annual Cash Bonus Payout'],
  ['PAID_UP_ADDITIONS', 'Paid-up Additions'],
);

export const CHILD_PAYOUT_STRUCTURES: Option[] = opts(
  ['LUMP_SUM_MATURITY', '100% Lump Sum at Maturity (Age 18 / 21)'],
  ['STAGGERED_MILESTONES', 'Staggered Milestones (School / Graduation / Post-Grad)'],
);

export const FREE_LOOK_PERIODS: Option[] = opts(
  ['15_DAYS', '15 Days (Physical Policy Contract)'],
  ['30_DAYS', '30 Days (Distance Marketing / Electronic Policy)'],
);

export const GROUP_SCHEME_TYPES: Option[] = opts(
  ['GROUP_TERM_LIFE', 'Group Term Life (GTL)'],
  ['GROUP_CREDIT_LIFE', 'Group Credit Life (Loan Linked)'],
  ['GROUP_GRATUITY', 'Group Gratuity Scheme'],
  ['GROUP_SUPERANNUATION', 'Group Superannuation Scheme'],
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
  ['EMPLOYER', 'Employer'],
  ['BUSINESS_PARTNER', 'Business Partner'],
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
  ['FATHER', 'Father'],
  ['MOTHER', 'Mother'],
  ['LEGAL_GUARDIAN', 'Court-Appointed Legal Guardian'],
  ['GRANDPARENT', 'Grandparent'],
  ['SPOUSE', 'Spouse'],
  ['SIBLING', 'Sibling (Brother / Sister)'],
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
// Section A Field Specifications per Plan Category (IRDAI Compliant)
// ---------------------------------------------------------------------------------

const TERM_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, hint: 'e.g. Product Name with IRDAI Unique Identification Number', placeholder: 'e.g. HDFC Life Click 2 Protect Super (UIN: 101N145V01)' },
  { key: 'sumAssured', label: 'Sum Assured (Death Benefit)', type: 'number', required: true, hint: 'Minimum ₹10,00,000', placeholder: 'e.g. 10000000' },
  { key: 'termYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Duration of coverage (5 to 50 years)', placeholder: 'e.g. 30' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'Years to pay premium (1 to term years)', placeholder: 'e.g. 10' },
  { key: 'coverUpToAge', label: 'Cover Up To Age (Years)', type: 'number', required: false, hint: 'Coverage age limit (e.g. 60, 65, 75, 85, 99)', placeholder: 'e.g. 75' },
  { key: 'deathBenefitPayoutOption', label: 'Death Benefit Settlement Option', type: 'select', required: true, options: DEATH_BENEFIT_PAYOUTS, defaultValue: 'LUMP_SUM' },
  { key: 'medicalTestRequired', label: 'Underwriting Medical Requirement', type: 'select', required: true, options: MEDICAL_TEST_REQUIREMENTS, defaultValue: 'NON_MEDICAL' },
  { key: 'terminalIllnessBenefitIncluded', label: 'Terminal Illness Acceleration Benefit Included', type: 'boolean', required: false, defaultValue: true },
];

const TERM_ROP_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. ICICI Pru iProtect Return of Premium (UIN: 105N181V01)' },
  { key: 'sumAssured', label: 'Sum Assured (Death Benefit)', type: 'number', required: true, hint: 'Minimum ₹5,00,000', placeholder: 'e.g. 5000000' },
  { key: 'termYears', label: 'Policy Term (Years)', type: 'number', required: true, placeholder: 'e.g. 25' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, placeholder: 'e.g. 10' },
  { key: 'coverUpToAge', label: 'Cover Up To Age (Years)', type: 'number', required: false, placeholder: 'e.g. 70' },
  { key: 'ropPercentage', label: 'Return of Premium % on Maturity', type: 'number', required: true, hint: 'Typically 100% of basic premiums paid', placeholder: 'e.g. 100' },
  { key: 'deathBenefitPayoutOption', label: 'Death Benefit Settlement Option', type: 'select', required: true, options: DEATH_BENEFIT_PAYOUTS, defaultValue: 'LUMP_SUM' },
  { key: 'medicalTestRequired', label: 'Underwriting Medical Requirement', type: 'select', required: true, options: MEDICAL_TEST_REQUIREMENTS, defaultValue: 'NON_MEDICAL' },
];

const ULIP_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. SBI Life eShield Next (UIN: 111L134V02)' },
  { key: 'annualInvestmentAmount', label: 'Target Annual Investment Premium', type: 'number', required: true, hint: 'Minimum ₹12,000 p.a.', placeholder: 'e.g. 120000' },
  { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Typically 10, 15, or 20 years', placeholder: 'e.g. 15' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'Typically 5, 7, 10 years or equal to term', placeholder: 'e.g. 10' },
  { key: 'fundChoice', label: 'Initial Fund Allocation Choice', type: 'select', required: true, options: ULIP_FUNDS, defaultValue: 'BALANCED' },
  { key: 'riskProfile', label: 'Investor Risk Tolerance Profile', type: 'select', required: true, options: RISK_PROFILES, defaultValue: 'MODERATE' },
  { key: 'premiumAllocationChargeStructure', label: 'Premium Allocation Charge Structure', type: 'text', required: false, placeholder: 'e.g. Nil allocation charges from Year 1' },
  { key: 'fundSwitchOption', label: 'Free Unlimited Fund Switches Allowed', type: 'boolean', required: false, defaultValue: true },
  { key: 'topUpAllowed', label: 'Enable Top-up Premium Facility', type: 'boolean', required: false, defaultValue: false },
];

const ENDOWMENT_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. LIC Jeevan Labh (UIN: 512N304V02)' },
  { key: 'sumAssured', label: 'Guaranteed Maturity Sum Assured', type: 'number', required: true, hint: 'Minimum ₹50,000', placeholder: 'e.g. 2500000' },
  { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, placeholder: 'e.g. 20' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, placeholder: 'e.g. 10' },
  { key: 'planVariant', label: 'Plan Variant / Participation Type', type: 'select', required: true, options: PLAN_VARIANTS, defaultValue: 'WITH_PROFIT' },
  { key: 'guaranteedAdditionPercent', label: 'Guaranteed Addition / Simple Reversionary Bonus (%)', type: 'number', required: false, hint: 'e.g. 5.5% p.a.', placeholder: 'e.g. 5.5' },
  { key: 'survivalBenefitOption', label: 'Survival Benefit / Money Back Option', type: 'boolean', required: false, defaultValue: false },
  { key: 'loanFacilityAvailable', label: 'Loan Facility Against Policy Available', type: 'boolean', required: false, defaultValue: true },
  { key: 'maturityPayoutOption', label: 'Maturity Payout Choice', type: 'select', required: true, options: opts(['LUMP_SUM', 'Lump Sum at Maturity'], ['REGULAR_ANNUAL_INCOME', 'Annual Structured Payout']), defaultValue: 'LUMP_SUM' },
];

const MONEY_BACK_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. LIC New Money Back Plan (UIN: 512N293V02)' },
  { key: 'sumAssured', label: 'Base Sum Assured', type: 'number', required: true, placeholder: 'e.g. 2000000' },
  { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Common terms: 15, 20, 25 years', placeholder: 'e.g. 20' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, placeholder: 'e.g. 15' },
  { key: 'survivalBenefitIntervalYears', label: 'Survival Benefit Payout Interval (Every N Years)', type: 'number', required: true, hint: 'e.g. Every 5th year 20% of Sum Assured', placeholder: 'e.g. 5' },
  { key: 'guaranteedAdditionPercent', label: 'Guaranteed Addition / Bonus (%)', type: 'number', required: false, placeholder: 'e.g. 4.5' },
  { key: 'maturityPayoutPercentage', label: 'Maturity Payout % (Remaining Balance + Bonus)', type: 'number', required: false, placeholder: 'e.g. 40' },
];

const WHOLE_LIFE_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. Tata AIA MahaLife Gold (UIN: 110N104V03)' },
  { key: 'sumAssured', label: 'Sum Assured', type: 'number', required: true, hint: 'Minimum ₹5,00,000', placeholder: 'e.g. 5000000' },
  { key: 'coverageUptoAge', label: 'Coverage Duration Limit (Age)', type: 'number', required: true, hint: '99 or 100 years of age', placeholder: 'e.g. 100' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, hint: 'e.g. 10, 15, or up to age 60', placeholder: 'e.g. 15' },
  { key: 'bonusType', label: 'Bonus Distribution Structure', type: 'select', required: true, options: BONUS_TYPES, defaultValue: 'SIMPLE_REVERSIONARY' },
  { key: 'survivalBenefitStartAge', label: 'Survival Income Benefit Start Age', type: 'number', required: false, placeholder: 'e.g. 60' },
  { key: 'loanFacilityAvailable', label: 'Loan Facility Against Policy Available', type: 'boolean', required: false, defaultValue: true },
];

const CHILD_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. HDFC Life Youngstar Super Premium (UIN: 101L069V02)' },
  { key: 'childName', label: 'Child Full Legal Name', type: 'text', required: true, placeholder: 'e.g. Aarav Sharma' },
  { key: 'childDob', label: 'Child Date of Birth', type: 'date', required: true },
  { key: 'childAgeAtEntry', label: "Child's Age at Entry (Years)", type: 'number', required: false, placeholder: 'e.g. 5' },
  { key: 'childGender', label: 'Child Gender', type: 'select', required: true, options: GENDERS, defaultValue: 'MALE' },
  { key: 'targetCorpus', label: 'Target Education / Marriage Corpus', type: 'number', required: true, hint: 'Projected financial goal in INR', placeholder: 'e.g. 5000000' },
  { key: 'policyTermYears', label: 'Policy Term (Years)', type: 'number', required: true, hint: 'Duration aligned with child reaching age 18 / 21', placeholder: 'e.g. 15' },
  { key: 'pptYears', label: 'Premium Paying Term (PPT)', type: 'number', required: true, placeholder: 'e.g. 10' },
  { key: 'payoutStructure', label: 'Payout Structure at Maturity / Milestones', type: 'select', required: true, options: CHILD_PAYOUT_STRUCTURES, defaultValue: 'LUMP_SUM_MATURITY' },
  { key: 'waiverOfPremiumOnParentDeath', label: 'Waiver of Premium (WOP) on Proposer Death', type: 'boolean', required: true, defaultValue: true, hint: 'Ensures future premiums are paid by insurer if parent passes away' },
];

const ANNUITY_FIELDS: FieldSpec[] = [
  { key: 'planNameAndUin', label: 'Plan Name & IRDAI UIN', type: 'text', required: true, placeholder: 'e.g. ICICI Pru Guaranteed Pension Plan (UIN: 105N180V01)' },
  { key: 'purchasePrice', label: 'Purchase Price / Investment Corpus', type: 'number', required: true, hint: 'Minimum ₹1,00,000 single lump-sum', placeholder: 'e.g. 5000000' },
  { key: 'annuityOption', label: 'Annuity Structure Option', type: 'select', required: true, options: ANNUITY_OPTIONS, defaultValue: 'LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE' },
  { key: 'payoutFrequency', label: 'Pension Annuity Payout Frequency', type: 'select', required: true, options: PREMIUM_FREQUENCIES, defaultValue: 'MONTHLY' },
  { key: 'defermentPeriodYears', label: 'Deferment Period (Years - 0 for Immediate Annuity)', type: 'number', required: false, placeholder: 'e.g. 0' },
  { key: 'commutationPercentAtVesting', label: 'Commutation % at Vesting (up to 60% tax-free)', type: 'number', required: false, placeholder: 'e.g. 33.3' },
];

const GROUP_FIELDS: FieldSpec[] = [
  { key: 'schemeType', label: 'Scheme Type / Master Policy Category', type: 'select', required: true, options: GROUP_SCHEME_TYPES, defaultValue: 'GROUP_TERM_LIFE' },
  { key: 'corporateName', label: 'Master Policyholder / Corporate Legal Name', type: 'text', required: true, placeholder: 'e.g. Acme Tech Solutions Pvt Ltd' },
  { key: 'totalMemberCount', label: 'Total Number of Lives Covered (Census Count)', type: 'number', required: true, placeholder: 'e.g. 250' },
  { key: 'sumAssuredPerMember', label: 'Sum Assured Per Member / Scheme Payout', type: 'number', required: true, placeholder: 'e.g. 1000000' },
  { key: 'loanAccountLinked', label: 'Loan Account Linked (Group Credit Life)', type: 'boolean', required: false, defaultValue: false },
  { key: 'schemeTenure', label: 'Scheme Tenure', type: 'text', required: false, placeholder: 'e.g. 1 Year Annually Renewable' },
];

export const SECTION_A_FIELDS: Record<string, FieldSpec[]> = {
  TERM_LIFE: TERM_FIELDS,
  TERM_WITH_ROP: TERM_ROP_FIELDS,
  ULIP: ULIP_FIELDS,
  ENDOWMENT: ENDOWMENT_FIELDS,
  MONEY_BACK: MONEY_BACK_FIELDS,
  WHOLE_LIFE: WHOLE_LIFE_FIELDS,
  CHILD_PLAN: CHILD_FIELDS,
  ANNUITY_PENSION: ANNUITY_FIELDS,

  // Canonical Prisma Enum Aliases
  TERM_INSURANCE: TERM_FIELDS,
  SAVINGS_PLANS: ENDOWMENT_FIELDS,
  INVESTMENT_PLANS: ULIP_FIELDS,
  RETIREMENT_PENSION: ANNUITY_FIELDS,
  CHILD_FUTURE: CHILD_FIELDS,
  ANNUITY: ANNUITY_FIELDS,
  GROUP_INSURANCE: GROUP_FIELDS,
};
