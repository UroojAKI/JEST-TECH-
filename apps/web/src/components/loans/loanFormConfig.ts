import { LoanCategory, LoanEnquiryStatus, LoanFacilityType } from '../../repositories/loans.repository';

export interface CategoryMetadata {
  id: LoanCategory;
  name: string;
  tagline: string;
  badgeColor: string;
  iconName: string;
  typicalTenureRange: string;
  typicalRateRange: string;
}

export const LOAN_CATEGORIES: Record<LoanCategory, CategoryMetadata> = {
  HOME_LOAN: {
    id: 'HOME_LOAN',
    name: 'Home Loan',
    tagline: 'Purchase, construction, plot purchase & home expansion',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    iconName: 'Home',
    typicalTenureRange: 'Up to 30 years (360 mos)',
    typicalRateRange: '8.35% - 9.75%',
  },
  LAP: {
    id: 'LAP',
    name: 'Loan Against Property (LAP)',
    tagline: 'Mortgage loan on residential, commercial or industrial property',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    iconName: 'Building',
    typicalTenureRange: 'Up to 15 years (180 mos)',
    typicalRateRange: '9.00% - 11.50%',
  },
  PERSONAL_LOAN: {
    id: 'PERSONAL_LOAN',
    name: 'Personal Loan',
    tagline: 'Unsecured financing for immediate liquidity, medical, wedding',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    iconName: 'User',
    typicalTenureRange: '1 to 5 years (12 - 60 mos)',
    typicalRateRange: '10.50% - 16.00%',
  },
  BUSINESS_LOAN: {
    id: 'BUSINESS_LOAN',
    name: 'Business Loan / Working Capital',
    tagline: 'Unsecured & secured business expansion, machinery & CC/OD',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
    iconName: 'Briefcase',
    typicalTenureRange: '1 to 7 years (12 - 84 mos)',
    typicalRateRange: '11.00% - 18.00%',
  },
  VEHICLE_LOAN: {
    id: 'VEHICLE_LOAN',
    name: 'Vehicle Loan',
    tagline: 'New and pre-owned passenger 4W, 2W & commercial vehicles',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    iconName: 'Car',
    typicalTenureRange: '1 to 7 years (12 - 84 mos)',
    typicalRateRange: '8.75% - 12.50%',
  },
  EDUCATION_LOAN: {
    id: 'EDUCATION_LOAN',
    name: 'Education Loan',
    tagline: 'Higher education in premier domestic & overseas universities',
    badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    iconName: 'GraduationCap',
    typicalTenureRange: 'Up to 15 years with moratorium',
    typicalRateRange: '9.50% - 13.00%',
  },
  GOLD_LOAN: {
    id: 'GOLD_LOAN',
    name: 'Gold Loan',
    tagline: 'Instant liquidity against 18k - 24k physical gold ornaments',
    badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    iconName: 'Coins',
    typicalTenureRange: '3 to 24 months',
    typicalRateRange: '9.25% - 15.00%',
  },
  SECURITIES_OD: {
    id: 'SECURITIES_OD',
    name: 'Loan Against Securities / OD',
    tagline: 'Overdraft line against mutual funds, shares, bonds & LIC policies',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200',
    iconName: 'TrendingUp',
    typicalTenureRange: '12 months renewable line',
    typicalRateRange: '9.00% - 11.75%',
  },
};

export const STATUS_CONFIG: Record<
  LoanEnquiryStatus,
  { label: string; badgeClass: string; description: string }
> = {
  DRAFT: {
    label: 'Draft Enquiry',
    badgeClass: 'bg-slate-100 text-slate-800 border-slate-300',
    description: 'Initial lead captured. Applicant & facility details logged.',
  },
  DOCUMENTS_PENDING: {
    label: 'Docs Pending',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    description: 'Awaiting borrower KYC, income or collateral documents.',
  },
  SUBMITTED_FOR_REVIEW: {
    label: 'Submitted for Review',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
    description: 'Submitted to credit underwriting team for evaluation.',
  },
  UNDERWRITING_IN_PROGRESS: {
    label: 'Underwriting',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    description: 'Logged to lenders, undergoing CIBIL and legal valuation.',
  },
  OFFERS_RECEIVED: {
    label: 'Offers Received',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-300',
    description: 'Competing quotes received from partner banks / NBFCs.',
  },
  OFFER_SELECTED: {
    label: 'Offer Selected',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-300',
    description: 'Borrower chosen primary lender sanction terms.',
  },
  SANCTIONED: {
    label: 'Sanctioned',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
    description: 'Formal bank sanction letter issued.',
  },
  DISBURSED: {
    label: 'Disbursed',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    description: 'Loan funds successfully released by lender into borrower account.',
  },
  REJECTED: {
    label: 'Rejected',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    description: 'Declined by underwriting or lender criteria.',
  },
  CANCELLED: {
    label: 'Cancelled / Withdrawn',
    badgeClass: 'bg-neutral-100 text-neutral-600 border-neutral-300',
    description: 'Borrower decided not to proceed.',
  },
};

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'checkbox' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  helpText?: string;
}

export const CATEGORY_FORM_FIELDS: Record<LoanCategory, FieldDefinition[]> = {
  HOME_LOAN: [
    {
      name: 'propertyType',
      label: 'Property Type',
      type: 'select',
      required: true,
      options: [
        { value: 'APARTMENT', label: 'Apartment / Flat' },
        { value: 'INDEPENDENT_VILLA', label: 'Independent House / Villa' },
        { value: 'RESIDENTIAL_PLOT', label: 'Residential Plot / Land' },
        { value: 'PLOT_PLUS_CONSTRUCTION', label: 'Plot + Construction' },
        { value: 'COMMERCIAL_UNIT', label: 'Commercial Unit' },
      ],
    },
    {
      name: 'propertyStage',
      label: 'Property Stage',
      type: 'select',
      required: true,
      options: [
        { value: 'READY_TO_MOVE', label: 'Ready to Move / Resale' },
        { value: 'UNDER_CONSTRUCTION', label: 'Under Construction' },
        { value: 'SELF_CONSTRUCTION', label: 'Self Construction' },
      ],
    },
    {
      name: 'builderName',
      label: 'Builder / Developer / Society Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Prestige Estates, Godrej Properties, Private Owner',
    },
    {
      name: 'totalCost',
      label: 'Total Property Agreement Value (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 7500000',
      helpText: 'Base agreement value excluding stamp duty and registration',
    },
    {
      name: 'carpetAreaSqFt',
      label: 'Carpet Area (Sq. Ft.)',
      type: 'number',
      required: false,
      placeholder: 'e.g. 1250',
    },
    {
      name: 'propertyAddress',
      label: 'Property Site Address',
      type: 'text',
      required: true,
      placeholder: 'Complete address of the unit/plot',
    },
    {
      name: 'city',
      label: 'City',
      type: 'text',
      required: true,
      placeholder: 'e.g. Mumbai, Bengaluru, Pune',
    },
    {
      name: 'pincode',
      label: 'Pincode',
      type: 'text',
      required: true,
      placeholder: '6 digit pincode',
    },
    {
      name: 'projectApprovedByRera',
      label: 'RERA Approved Project',
      type: 'checkbox',
      required: false,
      helpText: 'Check if project has a valid RERA registration number',
    },
  ],

  LAP: [
    {
      name: 'propertyType',
      label: 'Mortgaged Asset Type',
      type: 'select',
      required: true,
      options: [
        { value: 'RESIDENTIAL', label: 'Residential House / Flat' },
        { value: 'COMMERCIAL', label: 'Commercial Shop / Office' },
        { value: 'INDUSTRIAL', label: 'Industrial Shed / Plot' },
        { value: 'MIXED_USE', label: 'Mixed Use (Shop on GF, Resi on FF)' },
      ],
    },
    {
      name: 'occupancyStatus',
      label: 'Occupancy Status',
      type: 'select',
      required: true,
      options: [
        { value: 'SELF_OCCUPIED', label: 'Self Occupied' },
        { value: 'RENTED_OUT', label: 'Rented Out / Leased' },
        { value: 'VACANT', label: 'Vacant' },
      ],
    },
    {
      name: 'estimatedMarketValue',
      label: 'Estimated Market Value (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 15000000',
      helpText: 'Current realistic market valuation of the property',
    },
    {
      name: 'currentLoanOutstanding',
      label: 'Existing Loan Outstanding, if any (₹)',
      type: 'number',
      required: false,
      placeholder: '0 if fully unencumbered',
    },
    {
      name: 'propertyAddress',
      label: 'Property Address',
      type: 'text',
      required: true,
      placeholder: 'Complete property location',
    },
    {
      name: 'city',
      label: 'City',
      type: 'text',
      required: true,
      placeholder: 'e.g. Delhi, Hyderabad',
    },
    {
      name: 'pincode',
      label: 'Pincode',
      type: 'text',
      required: true,
      placeholder: '6 digit pincode',
    },
  ],

  PERSONAL_LOAN: [
    {
      name: 'companyName',
      label: 'Current Employer / Company Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Tata Consultancy Services, Infosys, Private Ltd',
    },
    {
      name: 'companyType',
      label: 'Company Classification',
      type: 'select',
      required: true,
      options: [
        { value: 'CAT_A_MNC', label: 'Category A MNC / Super Cat' },
        { value: 'PUBLIC_LTD', label: 'Public Listed Company' },
        { value: 'PVT_LTD', label: 'Private Limited Company' },
        { value: 'GOVT_PSU', label: 'Central / State Govt / PSU' },
        { value: 'PARTNERSHIP_PROPRIETOR', label: 'Proprietorship / LLP' },
      ],
    },
    {
      name: 'totalWorkExperienceYears',
      label: 'Total Work Experience (Years)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 5',
    },
    {
      name: 'monthlyNetSalary',
      label: 'Net In-Hand Monthly Salary (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 85000',
      helpText: 'Credit into bank account after all deductions',
    },
    {
      name: 'loanPurpose',
      label: 'Purpose of Personal Loan',
      type: 'select',
      required: true,
      options: [
        { value: 'DEBT_CONSOLIDATION', label: 'Debt Consolidation / Credit Card Payoff' },
        { value: 'HOME_RENOVATION', label: 'Home Renovation / Interior' },
        { value: 'WEDDING', label: 'Family Wedding / Function' },
        { value: 'MEDICAL_EMERGENCY', label: 'Medical Treatment / Emergency' },
        { value: 'TRAVEL', label: 'Vacation / Travel' },
        { value: 'OTHER', label: 'Other Personal Expenses' },
      ],
    },
  ],

  BUSINESS_LOAN: [
    {
      name: 'entityType',
      label: 'Business Constitution',
      type: 'select',
      required: true,
      options: [
        { value: 'PROPRIETORSHIP', label: 'Sole Proprietorship' },
        { value: 'PARTNERSHIP', label: 'Partnership Firm' },
        { value: 'LLP', label: 'Limited Liability Partnership (LLP)' },
        { value: 'PVT_LTD', label: 'Private Limited Company' },
        { value: 'PUBLIC_LTD', label: 'Public Limited Company' },
      ],
    },
    {
      name: 'annualTurnover',
      label: 'Annual Turnover (Latest FY) (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 25000000',
    },
    {
      name: 'businessVintageYears',
      label: 'Business Vintage (Years in Operation)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 6',
    },
    {
      name: 'gstRegistrationNumber',
      label: 'GSTIN Registration Number',
      type: 'text',
      required: false,
      placeholder: 'e.g. 27AAAAA0000A1Z5',
    },
    {
      name: 'hasAuditedFinancials',
      label: 'Financials Audited by Chartered Accountant',
      type: 'checkbox',
      required: false,
      helpText: 'Mandatory for facilities above ₹50 Lakhs',
    },
    {
      name: 'purposeDescription',
      label: 'Use of Funds / Facility Requirement',
      type: 'textarea',
      required: true,
      placeholder: 'e.g. Working capital inventory purchase, new branch fitouts',
    },
  ],

  VEHICLE_LOAN: [
    {
      name: 'vehicleCategory',
      label: 'Vehicle Category',
      type: 'select',
      required: true,
      options: [
        { value: 'FOUR_WHEELER_NEW', label: 'Passenger 4-Wheeler (New)' },
        { value: 'FOUR_WHEELER_USED', label: 'Passenger 4-Wheeler (Pre-Owned / Used)' },
        { value: 'TWO_WHEELER', label: 'Two Wheeler / Superbike' },
        { value: 'COMMERCIAL_VEHICLE', label: 'Commercial Vehicle (Truck/Bus/LCV)' },
      ],
    },
    {
      name: 'vehicleMake',
      label: 'Manufacturer / Make',
      type: 'text',
      required: true,
      placeholder: 'e.g. Hyundai, Tata Motors, Maruti Suzuki, Toyota',
    },
    {
      name: 'vehicleModel',
      label: 'Model & Variant',
      type: 'text',
      required: true,
      placeholder: 'e.g. Creta SX (O) Diesel AT',
    },
    {
      name: 'dealerName',
      label: 'Authorized Dealer Name & City',
      type: 'text',
      required: true,
      placeholder: 'e.g. Modi Hyundai, Andheri West',
    },
    {
      name: 'exShowroomPrice',
      label: 'Ex-Showroom Price (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 1800000',
    },
    {
      name: 'onRoadPrice',
      label: 'Total On-Road Price (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 2150000',
      helpText: 'Including RTO tax, insurance & accessories',
    },
  ],

  EDUCATION_LOAN: [
    {
      name: 'studentName',
      label: 'Student / Scholar Full Name',
      type: 'text',
      required: true,
      placeholder: 'Full name as per Passport / 10th marksheet',
    },
    {
      name: 'relationshipWithStudent',
      label: 'Applicant Relationship with Student',
      type: 'select',
      required: true,
      options: [
        { value: 'SELF', label: 'Self (Applicant is Student)' },
        { value: 'FATHER', label: 'Father' },
        { value: 'MOTHER', label: 'Mother' },
        { value: 'GUARDIAN_SPOUSE', label: 'Spouse / Legal Guardian' },
      ],
    },
    {
      name: 'targetCountry',
      label: 'Study Destination Country',
      type: 'select',
      required: true,
      options: [
        { value: 'INDIA', label: 'India' },
        { value: 'USA', label: 'United States of America (USA)' },
        { value: 'UK', label: 'United Kingdom (UK)' },
        { value: 'CANADA', label: 'Canada' },
        { value: 'GERMANY', label: 'Germany' },
        { value: 'AUSTRALIA', label: 'Australia' },
        { value: 'IRELAND', label: 'Ireland' },
        { value: 'OTHER', label: 'Other International' },
      ],
    },
    {
      name: 'instituteName',
      label: 'University / Institution Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Columbia University, University of Toronto, IIM Ahmedabad',
    },
    {
      name: 'courseDegreeName',
      label: 'Course & Degree Name',
      type: 'text',
      required: true,
      placeholder: 'e.g. Master of Science in Data Science (MS DS)',
    },
    {
      name: 'courseDurationYears',
      label: 'Course Duration (Years)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 2',
    },
    {
      name: 'totalTuitionFee',
      label: 'Total Program Cost & Living Expense (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 4500000',
    },
  ],

  GOLD_LOAN: [
    {
      name: 'goldForm',
      label: 'Gold Article Category',
      type: 'select',
      required: true,
      options: [
        { value: 'JEWELLERY_ORNAMENTS', label: 'Gold Ornaments & Jewellery' },
        { value: 'COINS_MINTED', label: 'Bank Minted Gold Coins (Up to 50g)' },
        { value: 'MIXED', label: 'Mixed Gold Assets' },
      ],
    },
    {
      name: 'purityCarat',
      label: 'Purity (Karat)',
      type: 'select',
      required: true,
      options: [
        { value: '24K', label: '24 Karat (99.9% pure)' },
        { value: '22K', label: '22 Karat (91.6% BIS Hallmark)' },
        { value: '20K', label: '20 Karat' },
        { value: '18K', label: '18 Karat (75.0% pure)' },
      ],
    },
    {
      name: 'grossWeightGrams',
      label: 'Gross Weight (Grams)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 120.5',
      helpText: 'Total scale weight including stones and waxes',
    },
    {
      name: 'netWeightGrams',
      label: 'Net Gold Weight (Grams)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 108.0',
      helpText: 'Pure gold weight excluding all stones and impurities',
    },
    {
      name: 'estimatedMarketValue',
      label: 'Appraised Collateral Market Value (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 650000',
      helpText: 'Calculated as Net Weight × Current RBI/IBJA Gold Rate',
    },
  ],

  SECURITIES_OD: [
    {
      name: 'collateralType',
      label: 'Eligible Security Instrument',
      type: 'select',
      required: true,
      options: [
        { value: 'MUTUAL_FUNDS_EQUITY', label: 'Equity Mutual Funds (CAMS/KFintech)' },
        { value: 'MUTUAL_FUNDS_DEBT', label: 'Debt & Liquid Mutual Funds' },
        { value: 'APPROVED_EQUITY_SHARES', label: 'Approved Equity Shares (Demat NSDL/CDSL)' },
        { value: 'LIFE_INSURANCE_SURRENDER', label: 'Life Insurance Assigned Surrender Value' },
        { value: 'GOVT_BONDS_SGB', label: 'Sovereign Gold Bonds (SGB) / RBI Bonds' },
      ],
    },
    {
      name: 'instrumentDetails',
      label: 'Folio / Demat DP ID / Policy Numbers',
      type: 'textarea',
      required: true,
      placeholder: 'Enter Folio Nos, DP ID, Scheme Names, Quantity of Units',
    },
    {
      name: 'currentMarketValue',
      label: 'Current Portfolio Market Value (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 3500000',
    },
    {
      name: 'proposedLimit',
      label: 'Requested Overdraft Line Limit (₹)',
      type: 'number',
      required: true,
      placeholder: 'e.g. 1750000',
      helpText: 'Typically 50% for equity securities and 80-85% for debt/SGBs',
    },
  ],
};

export interface ChecklistItem {
  id: string;
  name: string;
  mandatory: boolean;
  helpText: string;
}

export const CATEGORY_DOCUMENT_CHECKLISTS: Record<LoanCategory, ChecklistItem[]> = {
  HOME_LOAN: [
    { id: 'PAN_CARD', name: 'Borrower PAN Card', mandatory: true, helpText: 'Mandatory primary identity proof' },
    { id: 'AADHAAR_CARD', name: 'Aadhaar Card / OVD', mandatory: true, helpText: 'Address & identity verification' },
    { id: 'SALARY_SLIPS_ITR', name: 'Salary Slips (3 mos) or ITR (2 yrs)', mandatory: true, helpText: 'Income verification' },
    { id: 'BANK_STATEMENT', name: 'Bank Statement (Last 6 Months)', mandatory: true, helpText: 'Salary credit/business account' },
    { id: 'SALE_AGREEMENT', name: 'Agreement for Sale / Allotment Letter', mandatory: true, helpText: 'Executed agreement with builder/seller' },
    { id: 'TITLE_DEED', name: 'Prior Title Deeds / Chain Documents', mandatory: true, helpText: '13-30 years search documents' },
    { id: 'SANCTIONED_PLAN', name: 'Sanctioned Building Plan & OC', mandatory: false, helpText: 'Local municipal development approval' },
  ],

  LAP: [
    { id: 'PAN_CARD', name: 'PAN Card of all Owners', mandatory: true, helpText: 'Identity proof for all co-owners' },
    { id: 'AADHAAR_CARD', name: 'Aadhaar Card of all Owners', mandatory: true, helpText: 'Address & identity proof' },
    { id: 'ITR_COMPUTATION', name: 'ITR with Computation (Last 3 Years)', mandatory: true, helpText: 'Financial viability proof' },
    { id: 'BANK_STATEMENT', name: 'Bank Statements (12 Months)', mandatory: true, helpText: 'Banking turnover assessment' },
    { id: 'REGISTERED_DEED', name: 'Registered Title Deed / Sale Deed', mandatory: true, helpText: 'Original mortgage title' },
    { id: 'TAX_RECEIPT', name: 'Latest Property Tax Paid Receipt', mandatory: true, helpText: 'Municipal dues clearance' },
    { id: 'ENCUMBRANCE_CERT', name: 'Encumbrance Certificate (15-30 Years)', mandatory: false, helpText: 'Free from court attachments' },
  ],

  PERSONAL_LOAN: [
    { id: 'PAN_CARD', name: 'Applicant PAN Card', mandatory: true, helpText: 'CIBIL validation & tax ID' },
    { id: 'AADHAAR_CARD', name: 'Applicant Aadhaar Card', mandatory: true, helpText: 'Current residential address' },
    { id: 'SALARY_SLIPS', name: 'Latest 3 Months Salary Slips', mandatory: true, helpText: 'Reflecting deductions & allowances' },
    { id: 'SALARY_BANK_STATEMENT', name: 'Salary Account Statement (6 Months)', mandatory: true, helpText: 'Showing automated salary credits' },
    { id: 'COMPANY_ID', name: 'Employer Official ID Card / Offer Letter', mandatory: false, helpText: 'Company vintage check' },
  ],

  BUSINESS_LOAN: [
    { id: 'PAN_CARD', name: 'Entity PAN & Promoters PAN Card', mandatory: true, helpText: 'KYC of business & owners' },
    { id: 'AADHAAR_CARD', name: 'Promoters Aadhaar Card', mandatory: true, helpText: 'Residential verification' },
    { id: 'BUSINESS_PROOF', name: 'Certificate of Incorporation / Udyam / GST', mandatory: true, helpText: 'Business vintage proof' },
    { id: 'AUDITED_FINANCIALS', name: 'Audited Balance Sheet & P&L (2 Yrs)', mandatory: true, helpText: 'CA certified financial audits' },
    { id: 'GST_RETURNS', name: 'GST Returns (GSTR-3B for 12 Months)', mandatory: true, helpText: 'Turnover reconciliation' },
    { id: 'CURRENT_ACCOUNT_STMT', name: 'Current Account Bank Statement (12 Mos)', mandatory: true, helpText: 'Primary business account' },
  ],

  VEHICLE_LOAN: [
    { id: 'PAN_CARD', name: 'Borrower PAN Card', mandatory: true, helpText: 'Identity proof' },
    { id: 'AADHAAR_CARD', name: 'Borrower Aadhaar Card', mandatory: true, helpText: 'Residential address' },
    { id: 'INCOME_PROOF', name: 'Salary Slip / Form 16 / ITR', mandatory: true, helpText: 'Proof of debt service capability' },
    { id: 'BANK_STATEMENT', name: 'Bank Statement (6 Months)', mandatory: true, helpText: 'Banking track record' },
    { id: 'PROFORMA_INVOICE', name: 'Dealer Proforma Invoice', mandatory: true, helpText: 'Price quote from authorized dealer' },
    { id: 'USED_CAR_RC', name: 'RC Copy & Inspection Report (Used Car)', mandatory: false, helpText: 'Required only for pre-owned car' },
  ],

  EDUCATION_LOAN: [
    { id: 'PAN_STUDENT_COAPPLICANT', name: 'PAN Cards (Student & Co-Applicant)', mandatory: true, helpText: 'Both student and parent' },
    { id: 'AADHAAR_STUDENT_PARENT', name: 'Aadhaar Cards (Student & Parent)', mandatory: true, helpText: 'Identity & Address' },
    { id: 'ADMISSION_LETTER', name: 'Confirmed Admission Offer Letter', mandatory: true, helpText: 'From accredited university' },
    { id: 'FEE_SCHEDULE', name: 'Itemized University Fee Schedule / I-20', mandatory: true, helpText: 'Tuition and living expense estimate' },
    { id: 'ACADEMIC_RECORDS', name: '10th, 12th & Degree Marksheets + GRE/IELTS', mandatory: true, helpText: 'Student past academic performance' },
    { id: 'COAPPLICANT_INCOME', name: 'Co-Applicant Income Proof & Bank Stmt (6 Mos)', mandatory: true, helpText: 'Parent / sponsor debt serviceability' },
  ],

  GOLD_LOAN: [
    { id: 'PAN_CARD', name: 'Borrower PAN Card', mandatory: true, helpText: 'Identity proof' },
    { id: 'AADHAAR_CARD', name: 'Aadhaar Card / Voter ID', mandatory: true, helpText: 'Current residential address' },
    { id: 'VALUATION_CERT', name: 'Assayer Appraisal & Purity Certificate', mandatory: true, helpText: 'Generated during physical assay' },
    { id: 'PURCHASE_RECEIPT', name: 'Original Jewellery Purchase Bill / Receipt', mandatory: false, helpText: 'Ownership corroboration, if available' },
  ],

  SECURITIES_OD: [
    { id: 'PAN_CARD', name: 'Borrower PAN Card', mandatory: true, helpText: 'Mandatory for demat reconciliation' },
    { id: 'AADHAAR_CARD', name: 'Aadhaar Card', mandatory: true, helpText: 'Residential proof' },
    { id: 'DEMAT_CAS_STATEMENT', name: 'Consolidated Account Statement (CAS / CAMS)', mandatory: true, helpText: 'Holding statement reflecting lien eligible units' },
    { id: 'BANK_MANDATE', name: 'NACH / e-Mandate Blank Cancelled Cheque', mandatory: true, helpText: 'Linked savings or current account' },
  ],
};
